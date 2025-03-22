import Discord, { Client, DiscordAPIError } from "discord.js";
import got from "./utils/got-traces.js";
import { decode } from "html-entities";
import { Database } from "better-sqlite3";
import { JSDOM } from "jsdom";
import { sendWebhookMessage } from "./bot-utils.js";
import tokens from "./get-tokens.js";
import Logger from "./log.js";
import { container } from "@sapphire/framework";
import { DB } from "./db.js";

const major_webhook = new Discord.WebhookClient(tokens.majorWebhook);
const minor_webhook = new Discord.WebhookClient(tokens.minorWebhook);

function matchAll(regex: RegExp, string: string) {
	if (!regex.global) throw "Regex must be global";

	let matches;
	const allMatches = [];

	while ((matches = regex.exec(string)) !== null) {
		allMatches.push(matches);
	}

	return allMatches;
}

function getDate(updateString: string) {
	let matches = /(?<day>\d{1,2}) (?<month>[A-z]{3})(?:, (\d+))? @ (\d{1,2}):(\d{2})([ap]m)/g.exec(updateString);
	if (matches == null)
		matches = /(?<month>[A-z]{3}) (?<day>\d{1,2})(?:, (\d+))? @ (\d{1,2}):(\d{2})([ap]m)/g.exec(updateString);

	if (matches === null || matches.groups === undefined)
		throw new Error("Invalid date string: " + updateString);

	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const year = matches[3] ? parseInt(matches[3]) : new Date().getFullYear();
	const hours = parseInt(matches[4] == "12" ? "0" : matches[4]) + (matches[6] == "pm" ? 12 : 0);

	return new Date(Date.UTC(year, months.indexOf(matches.groups.month), parseInt(matches.groups.day), hours, parseInt(matches[5])));
}

interface EntryObject {
	id: string;
	title: string;
	description: string;
	author_steamid: string;
	image: string;
}

interface Changelog {
	date: Date;
	id: string;
	description: string;
}

interface Author {
	name?: string;
	avatar?: string;
	discordId?: string;
}

interface QueryFilesResponse {
	response: {
		publishedfiledetails?: {
			publishedfileid: string
			creator: string;
			title: string;
			file_description: string;
			time_updated: number;
			preview_url: string;
		}[];
		next_cursor: string;
	}
}

class WorkshopScanner {
	DB: Database;
	client: Client;
	initialized: boolean;
	avatarCache: Map<string, string>;
	nameCache: Map<string, string>;

	constructor() {
		this.DB = container.db.database;
		this.client = container.client;
		this.initialized = false;
		this.avatarCache = new Map<string, string>();
		this.nameCache = new Map<string, string>();
	}

	init(): void {
		this.DB.prepare("CREATE TABLE IF NOT EXISTS page_id (page_id INTEGER)").run();
		this.DB.prepare("CREATE TABLE IF NOT EXISTS author_lookup (steam_id TEXT UNIQUE, discord_id TEXT)").run();
		this.DB.prepare("CREATE TABLE IF NOT EXISTS workshop_mods (mod_id INTEGER PRIMARY KEY, last_post_id INTEGER)").run();
		this.initialized = true;
	}

	getLastScan(): number {
		return container.db.get(DB.global, "lastWorkshopScan", 0);
	}

	setLastScan(lastScan: number): void {
		container.db.set(DB.global, "lastWorkshopScan", lastScan);
	}

	async queryFiles(lastScan: number, updates: boolean) {
		const files = [];
		let cursor = "*";
		while (true) {
			const response = await fetch(`https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?${new URLSearchParams({
				key: process.env.STEAM_API_KEY!,
				appid: "341800",
				query_type: updates ? "21" : "1",
				numperpage: "100",
				return_metadata: "true",
				strip_description_bbcode: "true",
				cursor
			})}`);

			const data = await response.json();
			const { response: { publishedfiledetails, next_cursor } } = data as QueryFilesResponse;
			if (!publishedfiledetails || publishedfiledetails.length === 0) return files;

			for (const file of publishedfiledetails) {
				if (file.time_updated < lastScan / 1000) return files;

				files.push(file);
			}

			cursor = next_cursor;
		}
	}

	async find_workshop_mods(lastScan: number): Promise<false | EntryObject[]> {
		const entries_to_check: EntryObject[] = [];
		const files = (await this.queryFiles(lastScan, false))
			.concat(await this.queryFiles(lastScan, true))
			.sort((a, b) => a.time_updated - b.time_updated);

		if (files.length === 0) return false;

		for (const file of files) {
			if (entries_to_check.some(entry => entry.id === file.publishedfileid)) continue;

			let entry_object: EntryObject = {
				id: file.publishedfileid,
				title: file.title,
				description: file.file_description,
				image: file.preview_url,
				author_steamid: file.creator,
			};

			entries_to_check.push(entry_object);
		}

		if (entries_to_check.length === 0) {
			Logger.error("Failed to find any workshop entries");
			return false;
		}

		Logger.info(`Found ${entries_to_check.length} workshop entry matches`);

		return entries_to_check;
	}

	get_author_discord_id(author_steam_id: string): string | false {
		const sql = "SELECT author_lookup.discord_id FROM author_lookup WHERE author_lookup.steam_id = ? LIMIT 0, 1";
		const discord_id = this.DB.prepare(sql).get(author_steam_id) as { discord_id: string } | undefined;
		if (discord_id !== undefined) {
			return discord_id.discord_id;
		}

		return false;
	}

	async get_steam_avatar(author_steam_id: string): Promise<string | undefined> {
		if (!this.avatarCache.has(author_steam_id) && !(await this.get_steam_information(author_steam_id))) {
			return undefined;
		}

		return this.avatarCache.get(author_steam_id);
	}

	async get_steam_name(author_steam_id: string): Promise<string | undefined> {
		if (!this.nameCache.has(author_steam_id) && !(await this.get_steam_information(author_steam_id))) {
			return undefined;
		}

		return this.nameCache.get(author_steam_id);
	}

	async get_steam_information(author_steam_id: string): Promise<boolean> {
		const xml_url = `https://steamcommunity.com/profiles/${author_steam_id}?xml=1`;
		const { statusCode, body } = await got(xml_url);
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the steam avatar at ${decodeURI(xml_url)}`);
			return false;
		}

		const xml_document = new JSDOM(body, { contentType: "text/xml" }).window.document;

		// Users who haven't set up their profile yet don't have an avatar, so we can't get any information for them.
		const avatarTags = xml_document.getElementsByTagName("avatarMedium");
		if (avatarTags.length == 0) return false;

		const avatar = avatarTags[0].textContent;
		const steamID = xml_document.getElementsByTagName("steamID")[0].textContent;
		if (avatar == null || steamID == null)
			return false;

		this.avatarCache.set(author_steam_id, avatar);
		this.nameCache.set(author_steam_id, steamID);

		return true;
	}

	async check_mod(entry: EntryObject): Promise<boolean> {
		const mod_id = entry.id;
		const last_changelog_id = this.get_last_changelog_id(mod_id);

		const changelogs = await this.get_latest_changelogs(mod_id, last_changelog_id);
		if (changelogs === null || changelogs.length === 0) {
			return changelogs !== null;
		}

		let newMod = this.is_mod_new(mod_id) === true;
		const success = newMod ?
			this.insert_mod(mod_id, changelogs[0].id) :
			this.update_mod(mod_id, changelogs[0].id);

		if (success === false)
			return false;

		for (const changelog of changelogs.reverse()) {
			if (matchAll(/no bot announcement|\[no ?announce\]|\[ignore\]/ig, changelog.description).length > 0) {
				Logger.info("Discord post skipped because description contains ignore tag.");
				continue;
			}

			const author = await this.getAuthor(entry, changelog);

			// Remove the contributor from the description
			changelog.description = changelog.description.replace(/^Contrib\. \[.+\]\( ?https:\/\/steamcommunity\.com\/profiles\/\d+ ?\)\n\n/, "");

			const result = newMod ?
				await this.post_discord_new_mod(entry, changelog, author) :
				await this.post_discord_update_mod(entry, changelog, author);
			if (result !== false) {
				Logger.info("Discord post added.");

				// If a new mod was just posted, it's not a new mod anymore.
				newMod = false;
			} else {
				return false;
			}
		}

		return true;
	}

	// Returns the latest changelogs after the changelog ID passed in the since argument. Newest first.
	async get_latest_changelogs(mod_id: string, since: number): Promise<Changelog[] | null> {
		const changelog_url = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${mod_id}`;
		const { statusCode, body } = await got(changelog_url, {
			headers: {
				Cookie: "timezoneOffset=0,0"
			}
		});
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the changelog page at ${decodeURI(changelog_url)}`);
			return null;
		}

		const changelog_entries = matchAll(/<div class="changelog headline">([^]+?)<\/div>[^]+?<p id="([0-9]+)">(.*)<\/p>/g, body);
		if (changelog_entries.length === 0) {
			Logger.error(`Failed to find any changelog entries at ${decodeURI(changelog_url)}`);
			return null;
		}

		return changelog_entries.map(entry => {
			return {
				date: getDate(entry[1]),
				id: entry[2],
				description: decode(entry[3]),
			};
		}).filter(changelog => parseInt(changelog.id) > since);
	}

	is_mod_new(mod_id: string): boolean {
		const sql = "SELECT workshop_mods.mod_id FROM workshop_mods WHERE workshop_mods.mod_id = ? LIMIT 0, 1";
		const result = this.DB.prepare(sql).get(mod_id);
		if (result !== undefined) {
			return false;
		}
		Logger.info(`Mod ${mod_id} is new`);
		return true;
	}

	get_last_changelog_id(mod_id: string): number {
		const sql = "SELECT workshop_mods.last_post_id FROM workshop_mods WHERE workshop_mods.mod_id = ? LIMIT 0, 1";

		const result = this.DB.prepare(sql).get(mod_id) as { last_post_id: number } | undefined;
		if (result !== undefined)
			return result.last_post_id;

		return 0;
	}

	insert_mod(mod_id: string, changelog_id: string): boolean {
		const sql = "INSERT INTO workshop_mods (mod_id, last_post_id) VALUES (?, ?)";
		const run = this.DB.prepare(sql).run(mod_id, changelog_id);
		return run.changes === 1;
	}

	update_mod(mod_id: string, changelog_id: string): boolean {
		const sql = "UPDATE workshop_mods SET last_post_id = ? WHERE mod_id = ?";
		const run = this.DB.prepare(sql).run(changelog_id, mod_id);
		return run.changes === 1;
	}

	async getAuthor(entry_object: EntryObject, changelog: Changelog): Promise<{ name?: string, avatar?: string, discordId?: string }> {
		let steamId = entry_object.author_steamid;

		// Grab the contributor's Steam ID from the changelog if it's there.
		const contributor = changelog.description.match(/https:\/\/steamcommunity.com\/profiles\/(\d+)/);
		if (contributor) {
			steamId = contributor[1];
		}

		const discordId = this.get_author_discord_id(steamId);
		if (discordId !== false) {
			const user = await this.client.users.fetch(discordId).catch(error => error)
			if (!(user instanceof Error)) {
				return {
					name: user.username,
					avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
					discordId: user.id,
				}
			} else if (user instanceof DiscordAPIError) {
				this.DB.prepare(`DELETE FROM author_lookup WHERE discord_id=${discordId}`).run();
				Logger.warn(`Unable to find user with ID ${discordId}. ID removed from database.`);
			} else {
				Logger.error("Could not fetch Discord avatar.", user);
			}
		}

		return {
			name: await this.get_steam_name(steamId),
			avatar: await this.get_steam_avatar(steamId),
		}
	}

	async post_discord_new_mod(entry: EntryObject, changelog: Changelog, author: Author): Promise<boolean> {
		const mention = author.discordId ? `<@${author.discordId}>` : author.name;
		const embed = new Discord.EmbedBuilder({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${entry.id}`,
			description: entry.description.replace(/<br\s*\/?>/g, "\n").replace("\n\n", "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: author.name ?? "",
				icon_url: author.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			image: {
				url: entry.image
			},
			timestamp: changelog.date
		});

		embed.setColor("#00aa00");

		const data: Discord.WebhookMessageCreateOptions = {
			content: `:new: A new mod has been uploaded to the Steam Workshop! It's called **${entry.title}**, by ${mention}:`,
			embeds: [
				embed
			],
		};

		if (author.discordId !== undefined) {
			data.allowedMentions = {
				users: [author.discordId]
			};
		}

		return await this.post_discord(data, true);
	}

	async post_discord_update_mod(entry: EntryObject, changelog: Changelog, author: Author): Promise<boolean> {
		const mention = author.discordId ? `<@${author.discordId}>` : author.name;
		const embed = new Discord.EmbedBuilder({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/changelog/${entry.id}#${changelog.id}`,
			description: changelog.description.replace(/<br\s*\/?>/g, "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: author.name ?? "",
				icon_url: author.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			thumbnail: {
				url: entry.image
			},
			timestamp: changelog.date
		});

		embed.setColor("#0055aa");

		const data: Discord.WebhookMessageCreateOptions = {
			content: `:loudspeaker: ${mention} has posted an update to **${entry.title}** on the Steam Workshop!`,
			embeds: [
				embed
			],
		};

		if (author.discordId !== undefined) {
			data.allowedMentions = {
				users: [author.discordId]
			};
		}

		const major_regex = /major change|major update|rule[- ]breaking change|manual reprint( is)? (?:required|necessary|needed)|manual update|updated? manual/ig;
		const major_matches = matchAll(major_regex, changelog.description);
		return await this.post_discord(data, major_matches.length > 0);
	}

	async post_discord(options: Discord.WebhookMessageCreateOptions, is_major: boolean): Promise<boolean> {
		const webhook_client = is_major ? major_webhook : minor_webhook;

		try {
			if (tokens.debugging) {
				Logger.info(options);
				return true;
			}

			await sendWebhookMessage(this.client, webhook_client, options);
			return true;
		} catch (exception) {
			Logger.error("Failed to post to Discord", exception);
			return false;
		}
	}

	async run(): Promise<void> {
		//if (tokens.debugging)
		//	return;

		if (!this.initialized) {
			this.init();
		}

		const lastScan = this.getLastScan();
		const currentScan = Date.now();

		const entries_to_check = await this.find_workshop_mods(lastScan);
		if (entries_to_check === false) {
			return;
		}

		for (const entry of entries_to_check) {
			// If mod check fails, we can't set the last scan time.
			if (!(await this.check_mod(entry))) {
				return;
			}
		}

		this.setLastScan(currentScan);
	}
}

export default WorkshopScanner;