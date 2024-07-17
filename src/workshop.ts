import Discord, { Client, DiscordAPIError } from "discord.js";
import got from "./utils/got-traces";
import { decode } from "html-entities";
import { Database } from "better-sqlite3";
import { JSDOM } from "jsdom";
import { sendWebhookMessage } from "./bot-utils";
import tokens from "./get-tokens";
import Logger from "./log";
import { container } from "@sapphire/framework";

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
	author: string | undefined;
	authorMention: string;
	author_steamid: string;
	author_discordid: string | false;
	avatar: string | undefined;
}

interface Changelog {
	date: Date;
	id: string;
	description: string;
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

	get_page_index(): number {
		/*
		if(isset($_GET["page"]))
		{
			return (int)$_GET["page"];
		}*/

		const sql = "SELECT page_id FROM page_id LIMIT 0, 1";

		const page_id = this.DB.prepare(sql).get() as { page_id: number } | undefined;
		if (page_id !== undefined) {
			return page_id.page_id;
		}

		return 0;
	}

	set_page_index(page_index: number): void {
		this.DB.prepare("UPDATE page_id SET page_id = ?").run(page_index);
	}

	async scrape_workshop_list(page_number: number, number_per_page: number): Promise<string | false> {
		const steam_appid = 341800;
		const sort_mode = "mostrecent";
		const workshop_url = `https://steamcommunity.com/workshop/browse/?appid=${steam_appid}&browsesort=${sort_mode}&section=readytouseitems&actualsort=${sort_mode}&p=${page_number}&numperpage=${number_per_page}`;

		Logger.info(`Beginning scrape of page ${page_number}`);

		const { statusCode, body }: { statusCode: number, body: string } = await got(workshop_url);
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the workshop page at ${decodeURI(workshop_url)}`);
			return false;
		}

		Logger.info(`Received workshop page at ${decodeURI(workshop_url)}`);
		return body;
	}

	async find_workshop_mods(workshop_page: string): Promise<false | Map<string, EntryObject>> {
		const htmlDocument = new JSDOM(workshop_page).window.document;

		const itemsElement = htmlDocument.querySelector(".workshopBrowseItems");
		if (itemsElement === null) {
			Logger.error("Failed to find workshop items element");
			return false;
		}

		const entries_to_check = new Map<string, EntryObject>();
		for (let i = 0; i < itemsElement.children.length; i += 2) {
			const authorLink = itemsElement.children[i].querySelector(".workshop_author_link");
			if (authorLink === null) continue;

			const author = authorLink.textContent;
			const steamID = authorLink.getAttribute("href")?.match(/(id|profiles)\/[^/]+/);
			if (author === null || steamID == null) continue;

			const script = itemsElement.children[i + 1];
			const jsonMatch = script.textContent?.match(/{.+}/);
			if (jsonMatch == null) continue;

			let entry_object: EntryObject;
			try {
				entry_object = JSON.parse(jsonMatch[0]) as EntryObject;
			} catch (exception) {
				Logger.error(`Failed to JSON-parse a workshop entry, skipping; scraped contents were: ${jsonMatch[0]}`);
				continue;
			}

			entry_object.title = decode(entry_object.title);
			entry_object.description = decode(entry_object.description);

			entry_object.author_steamid = steamID[0];
			entry_object.author_discordid = this.get_author_discord_id(entry_object.author_steamid);

			const getSteamAuthor = async () => {
				entry_object.author = author !== "" ? author : await this.get_steam_name(entry_object.author_steamid);
				entry_object.avatar = await this.get_steam_avatar(entry_object.author_steamid);
			};

			if (entry_object.author_discordid !== false) {
				await this.client.users.fetch(entry_object.author_discordid)
					.then(user => {
						entry_object.author = user.username;
						entry_object.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
					})
					.catch(async error => {
						if (error instanceof DiscordAPIError) {
							this.DB.prepare(`DELETE FROM author_lookup WHERE discord_id=${entry_object.author_discordid}`).run();
							Logger.warn(`Unable to find user with ID ${entry_object.author_discordid}. ID removed from database.`);
						} else {
							Logger.error("Could not fetch Discord avatar.", error);
						}

						await getSteamAuthor();
					});
			} else {
				await getSteamAuthor();
			}

			if (entry_object.author_discordid !== false)
				entry_object.authorMention = `<@${entry_object.author_discordid}>`;
			else if (entry_object.author !== undefined)
				entry_object.authorMention = entry_object.author;
			else
				continue;

			entries_to_check.set(entry_object.id, entry_object);
		}

		if (entries_to_check.size === 0) {
			Logger.error("Failed to find any workshop entries");
			return false;
		}

		Logger.info(`Found ${entries_to_check.size} workshop entry matches`);

		return entries_to_check;
	}

	find_workshop_images(workshop_page: string): string[] | false {
		const workshop_image_entries = matchAll(/workshopItemPreviewImage.+src="(.+)"/g, workshop_page);
		if (workshop_image_entries.length == 0) {
			Logger.error("Failed to find any workshop image entries");
			return false;
		}

		Logger.info(`Found ${workshop_image_entries.length} workshop image entry matches`);

		return workshop_image_entries.map(entry => entry[1]);
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
		const xml_url = `https://steamcommunity.com/${author_steam_id}?xml=1`;
		const { statusCode, body } = await got(xml_url);
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the steam avatar at ${decodeURI(xml_url)}`);
			return false;
		}

		const xml_document = new JSDOM(body).window.document;

		// Users who haven't set up their profile yet don't have an avatar, so we can't get any information for them.
		const avatarTags = xml_document.getElementsByTagName("avatarMedium");
		if (avatarTags.length == 0)
			return false;

		const avatar = avatarTags[0].textContent;
		const steamID = xml_document.getElementsByTagName("steamID")[0].textContent;
		if (avatar == null || steamID == null)
			return false;

		this.avatarCache.set(author_steam_id, avatar);
		this.nameCache.set(author_steam_id, steamID);

		return true;
	}

	async check_mod(mod_id: string, entry: EntryObject, image: string): Promise<void> {
		const last_changelog_id = this.get_last_changelog_id(mod_id);

		const changelogs = await this.get_latest_changelogs(mod_id, last_changelog_id);
		if (changelogs === null || changelogs.length === 0) {
			return;
		}

		let newMod = this.is_mod_new(mod_id) === true;
		const success = newMod ?
			this.insert_mod(mod_id, changelogs[0].id) :
			this.update_mod(mod_id, changelogs[0].id);

		if (success === false)
			return;

		for (const changelog of changelogs.reverse()) {
			if (matchAll(/no bot announcement|\[no ?announce\]|\[ignore\]/ig, changelog.description).length > 0) {
				Logger.info("Discord post skipped because description contains ignore tag.");
				continue;
			}

			const result = newMod ?
				await this.post_discord_new_mod(mod_id, entry, changelog, image) :
				await this.post_discord_update_mod(mod_id, entry, changelog, image);
			if (result !== false) {
				Logger.info("Discord post added.");

				// If a new mod was just posted, it's not a new mod anymore.
				newMod = false;
			}
		}
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

	async post_discord_new_mod(mod_id: string, entry: EntryObject, changelog: Changelog, image: string): Promise<boolean> {
		const embed = new Discord.EmbedBuilder({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod_id}`,
			description: entry.description.replace(/<br\s*\/?>/g, "\n").replace("\n\n", "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: entry.author ?? "",
				icon_url: entry.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			image: {
				url: image
			},
			timestamp: changelog.date
		});

		embed.setColor("#00aa00");

		const data: Discord.WebhookMessageCreateOptions = {
			content: `:new: A new mod has been uploaded to the Steam Workshop! It's called **${entry.title}**, by ${entry.authorMention}:`,
			embeds: [
				embed
			],
		};

		if (entry.author_discordid !== false) {
			data.allowedMentions = {
				users: [entry.author_discordid]
			};
		}

		return await this.post_discord(data, true);
	}

	async post_discord_update_mod(mod_id: string, entry: EntryObject, changelog: Changelog, image: string): Promise<boolean> {
		const embed = new Discord.EmbedBuilder({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/changelog/${mod_id}#${changelog.id}`,
			description: changelog.description.replace(/<br\s*\/?>/g, "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: entry.author ?? "",
				icon_url: entry.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			thumbnail: {
				url: image
			},
			timestamp: changelog.date
		});

		embed.setColor("#0055aa");

		const data: Discord.WebhookMessageCreateOptions = {
			content: `:loudspeaker: ${entry.authorMention} has posted an update to **${entry.title}** on the Steam Workshop!`,
			embeds: [
				embed
			],
		};

		if (entry.author_discordid !== false) {
			data.allowedMentions = {
				users: [entry.author_discordid]
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

		const page_index = this.get_page_index();
		const expected_entry_count = 30;
		const workshop_page = await this.scrape_workshop_list(page_index, expected_entry_count);

		if (workshop_page === false) {
			this.set_page_index(1);
			return;
		}

		const entries_to_check = await this.find_workshop_mods(workshop_page);
		if (entries_to_check === false) {
			this.set_page_index(1);
			return;
		}

		const entries_to_image = this.find_workshop_images(workshop_page);
		if (entries_to_image === false) {
			this.set_page_index(1);
			return;
		}

		if (entries_to_check.size != entries_to_image.length) {
			Logger.warn(`The number of entries (${entries_to_check.size}) doesn't match the number of images (${entries_to_image.length}). Page will be rescanned. Body: ${workshop_page}`);
			return;
		}

		let image_index = 0;
		for (const [mod_id, entry] of entries_to_check.entries()) {
			const image = entries_to_image[image_index];
			await this.check_mod(mod_id, entry, image);
			image_index++;
		}

		this.set_page_index(page_index + 1);
	}
}

export default WorkshopScanner;