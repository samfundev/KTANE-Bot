import Discord, { Client, DiscordAPIError } from "discord.js";
import { Html5Entities } from "html-entities";
import { CoreOptions, get, Request, RequestCallback, Response } from "request";
import { Database } from 'sqlite';
import { promisify } from "util";
import { DOMParser } from "xmldom";
import tokens from "./get-tokens";
import Logger from "./log";

const getAsync = promisify(get as ((uri: string, options?: CoreOptions, callback?: RequestCallback) => Request)) as ((uri: string, options?: CoreOptions) => Promise<Response>);

const major_webhook = new Discord.WebhookClient(tokens.majorWebhook.id, tokens.majorWebhook.token);
const minor_webhook = new Discord.WebhookClient(tokens.minorWebhook.id, tokens.minorWebhook.token);

function matchAll(regex: RegExp, string: string) {
	if (!regex.global) throw "Regex must be global";

	let matches;
	let allMatches = [];

	while ((matches = regex.exec(string)) !== null) {
		allMatches.push(matches);
	}

	return allMatches;
}

function getDate(updateString: string) {
	let matches = /(?<day>\d{1,2}) (?<month>[A-z]{3})(?:, (\d+))? @ (\d{1,2}):(\d{2})([ap]m)/g.exec(updateString);
	if (matches == null)
		matches = /(?<month>[A-z]{3}) (?<day>\d{1,2})(?:, (\d+))? @ (\d{1,2}):(\d{2})([ap]m)/g.exec(updateString);

	if (matches == null)
		throw new Error("Invalid date string: " + updateString);

	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const year = matches[3] ? parseInt(matches[3]) : new Date().getFullYear();
	const hours = parseInt(matches[4] == "12" ? "0" : matches[4]) + (matches[6] == "pm" ? 12 : 0);

	return new Date(Date.UTC(year, months.indexOf(matches.groups!.month), parseInt(matches.groups!.day), hours, parseInt(matches[5])));
}

interface EntryObject {
	id: string;
	title: string;
	description: string;
	author: string | undefined;
	authorMention: string | undefined;
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
	avatarCache: { [author_steam_id: string]: string };
	nameCache: { [author_steam_id: string]: string };

	constructor(db: Database, client: Client) {
		this.DB = db;
		this.client = client
		this.initialized = false;
		this.avatarCache = {};
		this.nameCache = {};
	}

	async init() {
		await this.DB.run("CREATE TABLE IF NOT EXISTS page_id (page_id INTEGER)");
		await this.DB.run("CREATE TABLE IF NOT EXISTS author_lookup (steam_id TEXT UNIQUE, discord_id TEXT)");
		await this.DB.run("CREATE TABLE IF NOT EXISTS workshop_mods (mod_id INTEGER PRIMARY KEY, last_post_id INTEGER)");
		this.initialized = true;
	}

	async get_page_index(): Promise<number> {
		/*
		if(isset($_GET["page"]))
		{
			return (int)$_GET["page"];
		}*/

		const sql = "SELECT page_id FROM page_id LIMIT 0, 1";

		const page_id = await this.DB.get(sql);
		if (page_id !== undefined) {
			return page_id.page_id;
		}

		return 0;
	}

	async set_page_index(page_index: number) {
		const sql = "UPDATE page_id SET page_id = " + page_index;

		await this.DB.run(sql);
	}

	async scrape_workshop_list(page_number: number, number_per_page: number) {
		const steam_appid = 341800;
		const sort_mode = "mostrecent";
		const workshop_url = `https://steamcommunity.com/workshop/browse/?appid=${steam_appid}&browsesort=${sort_mode}&section=readytouseitems&actualsort=${sort_mode}&p=${page_number}&numperpage=${number_per_page}`;

		Logger.info(`Beginning scrape of page ${page_number}`);

		const { statusCode, body }: { statusCode: number, body: string } = await getAsync(workshop_url);
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the workshop page at ${decodeURI(workshop_url)}`);
			return false;
		}

		Logger.info(`Received workshop page at ${decodeURI(workshop_url)}`);
		return body;
	}

	async find_workshop_mods(workshop_page: string) {
		let workshop_mod_entries = matchAll(/workshopItemAuthorName">by&nbsp;<a href="[^]+?(id|profiles)\/([^]+?)\/[^]+?">([^]*?)<\/a>[^]+?SharedFileBindMouseHover\([^]+?(\{[^]+?\})/mg, workshop_page);

		if (workshop_mod_entries.length === 0) {
			Logger.error("Failed to find any workshop entries");
			return false;
		}

		Logger.info(`Found ${workshop_mod_entries.length} workshop entry matches`);

		const entries_to_check: { [id: string]: EntryObject } = {};
		for (let match_index = 0; match_index < workshop_mod_entries.length; match_index++) {
			let entry_object: EntryObject;
			const workshop_mod_entry = workshop_mod_entries[match_index];
			const workshop_mod_entry_json = workshop_mod_entry[4];

			try {
				entry_object = JSON.parse(workshop_mod_entry_json);
			} catch (exception) {
				Logger.error(`Failed to JSON-parse a workshop entry, skipping; scraped contents were: ${workshop_mod_entry_json}`);
				continue;
			}

			entry_object.title = Html5Entities.decode(entry_object.title);
			entry_object.description = Html5Entities.decode(entry_object.description);

			entry_object.author_steamid = `${workshop_mod_entry[1]}/${workshop_mod_entry[2]}`;
			entry_object.author_discordid = await this.get_author_discord_id(entry_object.author_steamid);

			const getSteamAuthor = async () => {
				entry_object.author = workshop_mod_entry[3] !== "" ? workshop_mod_entry[3] : await this.get_steam_name(entry_object.author_steamid);
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
							this.DB.get(`DELETE FROM author_lookup WHERE discord_id=${entry_object.author_discordid}`)
								.then(() => Logger.warn(`Unable to find user with ID ${entry_object.author_discordid}. ID removed from database.`))
								.catch(Logger.error);
						} else {
							Logger.error(error);
						}

						await getSteamAuthor();
					});
			} else {
				await getSteamAuthor();
			}

			entry_object.authorMention = entry_object.author_discordid !== false ? `<@${entry_object.author_discordid}>` : entry_object.author;

			entries_to_check[entry_object.id] = entry_object;
		}

		return entries_to_check;
	}

	find_workshop_images(workshop_page: string)
	{
		const workshop_image_entries = matchAll(/workshopItemPreviewImage.+src="(.+)"/g, workshop_page);
		if (workshop_image_entries.length == 0)
		{
			Logger.error("Failed to find any workshop image entries");
			return false;
		}

		Logger.info(`Found ${workshop_image_entries.length} workshop image entry matches`);

		const entries_to_image = [];
		for (const workshop_mod_entry of workshop_image_entries)
		{
			entries_to_image.unshift(workshop_mod_entry[1]);
		}

		return entries_to_image;
	}

	async get_author_discord_id(author_steam_id: string)
	{
		const sql = "SELECT author_lookup.discord_id FROM author_lookup WHERE author_lookup.steam_id = \"" + author_steam_id + "\" LIMIT 0, 1";
		const discord_id = await this.DB.get(sql);
		if (discord_id !== undefined) {
			return discord_id.discord_id;
		}

		return false;
	}

	async get_steam_avatar(author_steam_id: string)
	{
		if (!this.avatarCache.hasOwnProperty(author_steam_id) && !(await this.get_steam_information(author_steam_id))) {
			return undefined;
		}

		return this.avatarCache[author_steam_id];
	}

	async get_steam_name(author_steam_id: string)
	{
		if (!this.nameCache.hasOwnProperty(author_steam_id) && !(await this.get_steam_information(author_steam_id))) {
			return undefined;
		}

		return this.nameCache[author_steam_id];
	}

	async get_steam_information(author_steam_id: string)
	{
		const xml_url = `https://steamcommunity.com/${author_steam_id}?xml=1`;
		const { statusCode, body } = await getAsync(xml_url);
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the steam avatar at ${decodeURI(xml_url)}`);
			return false;
		}

		const xml_document = new DOMParser().parseFromString(body, "text/xml");
		const avatar = xml_document.getElementsByTagName("avatarMedium")[0].textContent;
		const steamID = xml_document.getElementsByTagName("steamID")[0].textContent;
		if (avatar == null || steamID == null)
			return false;

		this.avatarCache[author_steam_id] = avatar;
		this.nameCache[author_steam_id] = steamID;

		return true;
	}

	async check_mod(mod_id: string, entry: EntryObject, image: string)
	{
		const last_changelog_id = await this.get_last_changelog_id(mod_id);

		const changelogs = await this.get_latest_changelogs(mod_id, last_changelog_id);
		if (changelogs === null || changelogs.length === 0) {
			return;
		}

		const newMod = await this.is_mod_new(mod_id) === true;
		const success = newMod ?
			await this.insert_mod(mod_id, changelogs[0].id) :
			await this.update_mod(mod_id, changelogs[0].id);

		if (success === false)
			return;

		for (const changelog of changelogs.reverse()) {
			if (matchAll(/no bot announcement|\[no ?announce\]|\[ignore\]/ig, changelog.description).length > 0) {
				Logger.info(`Discord post skipped because description contains ignore tag.`);
				continue;
			}

			const result = newMod ?
				await this.post_discord_new_mod(mod_id, entry, changelog, image) :
				await this.post_discord_update_mod(mod_id, entry, changelog, image);
			if (result !== false)
			{
				Logger.info("Discord post added.");
			}
		}
	}

	// Returns the latest changelogs after the changelog ID passed in the since argument. Newest first.
	async get_latest_changelogs(mod_id: string, since: number): Promise<Changelog[] | null>
	{
		const changelog_url = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${mod_id}`;
		const { statusCode, body } = await getAsync(changelog_url, {
			headers: {
				Cookie: "timezoneOffset=0,0"
			}
		});
		if (statusCode != 200) {
			Logger.error(`Failed to retrieve the changelog page at ${decodeURI(changelog_url)}`);
			return null;
		}

		const changelog_entries = matchAll(/<div class="changelog headline">([^]+?)<\/div>[^]+?<p id="([0-9]+)">(.*)<\/p>/g, body);
		if (changelog_entries.length === 0)
		{
			Logger.error(`Failed to find any changelog entries at ${decodeURI(changelog_url)}`);
			return null;
		}

		return changelog_entries.map(entry => {
			return {
				date: getDate(entry[1]),
				id: entry[2],
				description: Html5Entities.decode(entry[3]),
			};
		}).filter(changelog => parseInt(changelog.id) > since);
	}

	async is_mod_new(mod_id: string)
	{
		const sql = "SELECT workshop_mods.mod_id FROM workshop_mods WHERE workshop_mods.mod_id = " + mod_id + " LIMIT 0, 1";
		const result = await this.DB.get(sql);
		if (result !== undefined)
		{
			return false;
		}
		Logger.info(`Mod ${mod_id} is new`);
		return true;
	}

	async get_last_changelog_id(mod_id: string)
	{
		const sql = "SELECT workshop_mods.last_post_id FROM workshop_mods WHERE workshop_mods.mod_id = " + mod_id + " LIMIT 0, 1";

		const result = await this.DB.get<{ last_post_id: number }>(sql);
		if (result !== undefined)
			return result.last_post_id;

		return 0;
	}

	async insert_mod(mod_id: string, changelog_id: string)
	{
		const sql = "INSERT INTO workshop_mods (mod_id, last_post_id) VALUES (" + mod_id + ", " + changelog_id + ")";
		return this.DB.run(sql).then(() => true).catch(() => false);
	}

	async update_mod(mod_id: string, changelog_id: string)
	{
		const sql = "UPDATE workshop_mods SET last_post_id = " + changelog_id + " WHERE mod_id = " + mod_id;
		return this.DB.run(sql).then(() => true).catch(() => false);
	}

	async post_discord_new_mod(mod_id: string, entry: EntryObject, changelog: Changelog, image: string)
	{
		const embed = new Discord.MessageEmbed({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod_id}`,
			description: entry.description.replace(/<br\s*\/?>/g, "\n").replace("\n\n", "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: entry.author,
				icon_url: entry.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			image: {
				url: image
			},
			timestamp: changelog.date
		});

		embed.setColor("#00aa00");

		const data = {
			content: `:new: A new mod has been uploaded to the Steam Workshop! It's called **${entry.title}**, by ${entry.authorMention}:`,
			options: {
				disableEveryone: true,
				embeds: [
					embed
				],
			}
		};

		return await this.post_discord(data, true);
	}

	async post_discord_update_mod(mod_id: string, entry: EntryObject, changelog: Changelog, image: string)
	{
		const embed = new Discord.MessageEmbed({
			title: entry.title,
			url: `https://steamcommunity.com/sharedfiles/filedetails/changelog/${mod_id}#${changelog.id}`,
			description: changelog.description.replace(/<br\s*\/?>/g, "\n").replace(/<a.*?>(.+?)<\/a>/g, "$1").substring(0, 1000),
			author: {
				name: entry.author,
				icon_url: entry.avatar,
				url: `https://steamcommunity.com/${entry.author_steamid}`
			},
			thumbnail: {
				url: image
			},
			timestamp: changelog.date
		});

		embed.setColor("#0055aa");

		const data = {
			content: `:loudspeaker: ${entry.authorMention} has posted an update to **${entry.title}** on the Steam Workshop!`,
			options: {
				disableEveryone: true,
				embeds: [
					embed
				],
			}
		};

		const major_regex = /major change|major update|rule[- ]breaking change|manual reprint( is)? (?:required|necessary|needed)|manual update|updated? manual/ig;
		const major_matches = matchAll(major_regex, changelog.description);
		return await this.post_discord(data, major_matches.length > 0);
	}

	async post_discord(data: { content: string, options: Discord.WebhookMessageOptions & { split?: false } }, is_major: boolean)
	{
		const webhook_client = is_major ? major_webhook : minor_webhook;

		try {
			if (tokens.debugging) {
				console.log(data);
				return await new Promise((resolve) => resolve());
			}

			return await webhook_client.send(data.content, data.options).then(() => true).catch(error => { Logger.error(error); return false; });
		} catch (exception) {
			Logger.error("Failed to post to Discord");
		}
	}

	async run() {
		if (tokens.debugging)
			return;

		if (!this.initialized) {
			await this.init();
		}

		const page_index = await this.get_page_index();
		const expected_entry_count = 30;
		const workshop_page = await this.scrape_workshop_list(page_index, expected_entry_count);

		if (workshop_page === false)
		{
			await this.set_page_index(1);
			return;
		}

		const entries_to_check = await this.find_workshop_mods(workshop_page);
		if (entries_to_check === false)
		{
			await this.set_page_index(1);
			return;
		}

		const entries_to_image = await this.find_workshop_images(workshop_page);
		if (entries_to_image === false)
		{
			await this.set_page_index(1);
			return;
		}

		if (Object.keys(entries_to_check).length != entries_to_image.length) {
			Logger.warn(`The number of entries (${Object.keys(entries_to_check).length}) doesn't match the number of images (${entries_to_image.length}). Page will be rescanned. Body: ${workshop_page}`);
			return;
		}

		let image_index = 0;
		for (const mod_id in entries_to_check) {
			const entry = entries_to_check[mod_id];
			const image = entries_to_image[image_index];
			await this.check_mod(mod_id, entry, image);
			image_index++;
		}

		await this.set_page_index(page_index + 1);
	}
}

export default WorkshopScanner;