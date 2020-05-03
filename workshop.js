const Discord = require("discord.js");
const { get } = require("request");
const logger = require("./log");
const { promisify } = require("util");
const tokens = require("./tokens");
const Html5Entities = require("html-entities").Html5Entities;
const { DOMParser } = require("xmldom");

const getAsync = promisify(get);

const major_webhook = new Discord.WebhookClient(tokens.majorWebhook.id, tokens.majorWebhook.token);
const minor_webhook = new Discord.WebhookClient(tokens.minorWebhook.id, tokens.minorWebhook.token);

function matchAll(regex, string) {
	if (!regex.global) throw "Regex must be global";

	let matches;
	let allMatches = [];

	while ((matches = regex.exec(string)) !== null) {
		allMatches.push(matches);
	}

	return allMatches;
}

function getDate(updateString) {
	const matches = /(\d{1,2}) ([A-z]{3})(?:, (\d+))? @ (\d{1,2}):(\d{2})([ap]m)/g.exec(updateString);
	
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const year = matches[3] ? parseInt(matches[3]) : new Date().getFullYear();
	const hours = parseInt(matches[4]) + (matches[6] == "pm" ? 12 : 0) + 8; // Time is shown in PST by default which is 8 hours less than UTC.
	return new Date(Date.UTC(year, months.indexOf(matches[2]), parseInt(matches[1]), hours, parseInt(matches[5])));
}

class WorkshopScanner {
	constructor(db, client) {
		this.DB = db;
		this.client = client
		this.initialized = false;
		this.avatarCache = {};
	}

	async init() {
		await this.DB.run("CREATE TABLE IF NOT EXISTS page_id (page_id INTEGER)");
		await this.DB.run("CREATE TABLE IF NOT EXISTS author_lookup (steam_id TEXT UNIQUE, discord_id TEXT)");
		await this.DB.run("CREATE TABLE IF NOT EXISTS workshop_mods (mod_id INTEGER PRIMARY KEY, last_post_id INTEGER)");
		this.initialized = true;
	}

	async get_page_index() {
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

	async set_page_index(page_index) {
		const sql = "UPDATE page_id SET page_id = " + page_index;

		await this.DB.run(sql);
	}

	async scrape_workshop_list(page_number, number_per_page) {
		const steam_appid = 341800;
		const sort_mode = "mostrecent";
		const workshop_url = `https://steamcommunity.com/workshop/browse/?appid=${steam_appid}&browsesort=${sort_mode}&section=readytouseitems&actualsort=${sort_mode}&p=${page_number}&numperpage=${number_per_page}`;

		logger.info(`Beginning scrape of page ${page_number}`);

		const { statusCode, body } = await getAsync(workshop_url);
		if (statusCode != 200) {
			logger.error(`Failed to retrieve the workshop page at ${decodeURI(workshop_url)}`);
			return false;
		}

		logger.info(`Received workshop page at ${decodeURI(workshop_url)}`);
		return body;
	}

	async find_workshop_mods(workshop_page) {
		let workshop_mod_entries = matchAll(/workshopItemAuthorName">by&nbsp;<a href="[^]+?(id|profiles)\/([^]+?)\/[^]+?">([^]+?)<\/a>[^]+?SharedFileBindMouseHover\([^]+?(\{[^]+?\})/mg, workshop_page);

		if (workshop_mod_entries.length === 0) {
			logger.error("Failed to find any workshop entries");
			return false;
		}

		logger.info(`Found ${workshop_mod_entries.length} workshop entry matches`);

		const entries_to_check = {};
		for (let match_index = 0; match_index < workshop_mod_entries.length; match_index++) {
			let entry_object;
			const workshop_mod_entry = workshop_mod_entries[match_index];
			const workshop_mod_entry_json = workshop_mod_entry[4];

			try {
				entry_object = JSON.parse(workshop_mod_entry_json);
			} catch (exception) {
				logger.error(`Failed to JSON-parse a workshop entry, skipping; scraped contents were: ${workshop_mod_entry_json}`);
				continue;
			}

			entry_object.title = Html5Entities.decode(entry_object.title);
			entry_object.description = Html5Entities.decode(entry_object.description);

			entry_object.author_steamid = `${workshop_mod_entry[1]}/${workshop_mod_entry[2]}`;
			entry_object.author_discordid = await this.get_author_discord_id(entry_object.author_steamid);
			
			if (entry_object.author_discordid !== false) {
				await this.client.fetchUser(entry_object.author_discordid)
					.then(user => {
						entry_object.author = user.username;
						entry_object.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
					})
					.catch(logger.warn);
			} else {
				entry_object.author = workshop_mod_entry[3];
				entry_object.avatar = await this.get_steam_avatar(entry_object.author_steamid);
			}

			entry_object.authorMention = entry_object.author_discordid !== false ? `<@${entry_object.author_discordid}>` : entry_object.author;

			entries_to_check[entry_object.id] = entry_object;
		}

		return entries_to_check;
	}

	find_workshop_images(workshop_page)
	{
		const workshop_image_entries = matchAll(/workshopItemPreviewImage.+src="(.+)"/g, workshop_page);
		if (workshop_image_entries.length == 0)
		{
			logger.error("Failed to find any workshop image entries");
			return false;
		}

		logger.info(`Found ${workshop_image_entries.length} workshop image entry matches`);

		const entries_to_image = [];
		for (const workshop_mod_entry of workshop_image_entries)
		{
			entries_to_image.unshift(workshop_mod_entry[1]);
			logger.info(`Found workshop image ${workshop_mod_entry[1]}`);
		}

		return entries_to_image;
	}

	async get_author_discord_id(author_steam_id)
	{
		const sql = "SELECT author_lookup.discord_id FROM author_lookup WHERE author_lookup.steam_id = \"" + author_steam_id + "\" LIMIT 0, 1";
		const discord_id = await this.DB.get(sql);
		if (discord_id !== undefined) {
			return discord_id.discord_id;
		}

		return false;
	}

	async get_steam_avatar(author_steam_id)
	{
		if (this.avatarCache.hasOwnProperty(author_steam_id))
			return this.avatarCache[author_steam_id];

		const xml_url = `https://steamcommunity.com/${author_steam_id}?xml=1`;
		const { statusCode, body } = await getAsync(xml_url);
		if (statusCode != 200) {
			logger.error(`Failed to retrieve the steam avatar at ${decodeURI(xml_url)}`);
			return null;
		}

		const avatar_url = new DOMParser().parseFromString(body, "text/xml").getElementsByTagName("avatarMedium")[0].textContent;
		this.avatarCache[author_steam_id] = avatar_url;
		return avatar_url;
	}

	async check_mod(mod_id, entry, image)
	{
		const changelog = await this.get_latest_changelog(mod_id);
		if (changelog === null)
		{
			return;
		}

		if (await this.is_mod_new(mod_id) === true)
		{
			if (await this.insert_mod(mod_id, changelog.id) === true)
			{
				if (matchAll(/no bot announcement|\[no ?announce\]|\[ignore\]/ig, changelog.description).length > 0)
				{
					logger.info(`Discord post skipped because description contains ignore tag.`);
					await this.insert_mod(mod_id, changelog.id);
				}
				else if (await this.post_discord_new_mod(mod_id, entry, changelog, image) !== false)
				{
					logger.info("Discord post added.");
					await this.insert_mod(mod_id, changelog.id);
				}
			}
		}
		else
		{
			if (await this.is_mod_updated(mod_id, changelog.id) === false)
			{
				if (await this.update_mod(mod_id, changelog.id) === true)
				{
					if (matchAll(/no bot announcement|\[no ?announce\]|\[ignore\]/ig, changelog.description).length > 0)
					{
						logger.info(`Discord post skipped because description contains ignore tag.`);
					}
					else if (await this.post_discord_update_mod(mod_id, entry, changelog, image) !== false)
					{
						logger.info("Discord post added.");
					}
				}
			}
		}
	}

	async get_latest_changelog(mod_id)
	{
		const changelog_url = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${mod_id}`;
		const { statusCode, body } = await getAsync(changelog_url);
		if (statusCode != 200) {
			logger.error(`Failed to retrieve the changelog page at ${decodeURI(changelog_url)}`);
			return null;
		}

		const changelog_entries = /<div class="changelog headline">([^]+?)<\/div>[^]+?<p id="([0-9]+)">(.*)<\/p>/.exec(body);
		if (changelog_entries === null)
		{
			logger.error(`Failed to find any changelog entries at ${decodeURI(changelog_url)}\n${body}`);
			return null;
		}

		return {
			date: getDate(changelog_entries[1]),
			id: changelog_entries[2],
			description: changelog_entries[3],
		}
	}

	async is_mod_new(mod_id)
	{
		const sql = "SELECT workshop_mods.mod_id FROM workshop_mods WHERE workshop_mods.mod_id = " + mod_id + " LIMIT 0, 1";
		const result = await this.DB.get(sql);
		if (result !== undefined)
		{
			logger.info(`Mod ${mod_id} is not new`);
			return false;
		}
		logger.info(`Mod ${mod_id} is new`);
		return true;
	}

	async is_mod_updated(mod_id, changelog_id)
	{
		logger.info(`Checking mod ${mod_id} against changelog ${changelog_id}`);
		const sql = "SELECT workshop_mods.mod_id, workshop_mods.last_post_id FROM workshop_mods WHERE workshop_mods.mod_id = " + mod_id + " AND workshop_mods.last_post_id = " + changelog_id + " LIMIT 0, 1";

		const result = await this.DB.get(sql);
		if (result !== undefined)
		{
			logger.info(`Mod ${mod_id} is up-to-date`);
			return true;
		}

		logger.info(`Mod ${mod_id} is not up-to-date (${changelog_id})`);
		return false;
	}

	async insert_mod(mod_id, changelog_id)
	{
		const sql = "INSERT INTO workshop_mods (mod_id, last_post_id) VALUES (" + mod_id + ", " + changelog_id + ")";
		return this.DB.run(sql).then(() => true).catch(() => false);
	}

	async update_mod(mod_id, changelog_id)
	{
		const sql = "UPDATE workshop_mods SET last_post_id = " + changelog_id + " WHERE mod_id = " + mod_id;
		return this.DB.run(sql).then(() => true).catch(() => false);
	}

	async post_discord_new_mod(mod_id, entry, changelog, image)
	{
		const embed = new Discord.RichEmbed({
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

	async post_discord_update_mod(mod_id, entry, changelog, image)
	{
		const embed = new Discord.RichEmbed({
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

	async post_discord(data, is_major)
	{
		const webhook_client = is_major ? major_webhook : minor_webhook;

		try {
			return await webhook_client.send(data.content, data.options).then(() => true).catch(error => { logger.error(error); return false; });
		} catch (exception) {
			logger.error("Failed to post to Discord");
		}
	}

	async run() {
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
			logger.warn(`The number of entries (${Object.keys(entries_to_check).length}) doesn't match the number of images (${entries_to_image.length}). Page will be rescanned. Body: ${workshop_page}`);
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

module.exports = WorkshopScanner;