import { GuildChannel, CategoryChannel, GuildMember, TextChannel, WebhookClient, MessageReaction, User } from 'discord.js';
import * as commando from "discord.js-commando";
import cron from "node-cron";
import path from "path";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import request from "request";
import logger from "log";
import WorkshopScanner from "./workshop";
import TaskManager from "task-manager";
import tokens from "get-tokens";
import { unpartial } from "bot-utils"

const client = new commando.CommandoClient({
	owner: "76052829285916672",
	commandPrefix: "!",
	nonCommandEditable: false,
	fetchAllMembers: true,
	partials: ["MESSAGE", "REACTION"]
});

TaskManager.client = client;

let voiceText: GuildChannel = null;	// #voice-text text channel
let voiceChannelsRenamed: { [id: string]: boolean } = {};

client
	.on("error", logger.error)
	.on("warn", logger.warn)
	.on("debug", logger.info)
	.on("ready", () => {
		logger.info(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client?.user.id})`);

		// Scan for new or ended KTANE streams to catch anyone before we started up
		client.guilds.cache.forEach(guild => {
			if (!guild.available)
				return;

			guild.members.cache.forEach(checkStreamingStatus);
			guild.channels.cache.forEach(channel => {
				if (channel.name === 'voice-text' && channel.type === 'text')
					voiceText = channel;
			});
		});
	})
	.on("providerReady", () => {
		scheduledTask();

		if (client.provider.get("global", "updating", false)) {
			client.provider.remove("global", "updating");

			if (typeof client.options.owner == "string")
				client.users.fetch(client.options.owner).then(user => user.send("Update is complete."));
		}
	})
	.on("disconnect", () => { logger.warn("Disconnected!"); })
	.on("commandError", (cmd, err) => {
		if (err instanceof commando.FriendlyError) return;
		logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on("message", async (message) => {
		if (!await unpartial(message) || message.channel.type != "text")
			return;

		if (message.channel.name == "voice-text") {
			message.attachments.some(attachment => {
				var file = attachment.name;
				if (file.includes("output_log") || file.includes("Player.log")) {
					message.channel.send({
						embed: {
							"title": "Logfile Analyzer Link",
							"description": "[" + file + "](https://ktane.timwi.de/lfa#url=" + attachment.url + ")",
							"color": 1689625
						}
					});
					return true;
				}
			});
		} else if (message.channel.name == "rules") {
			if (message.member.roles.highest.comparePositionTo(message.guild.roles.cache.get(tokens.roleIDs.moderator)) >= 0)
				return;

			message.delete().catch(logger.error);
		}
	})
	.on("voiceStateUpdate", (oldState, newState) => {
		const oldMember = oldState.member;
		const newMember = newState.member;

		// VOICE-MUTING
		let muted = newMember.roles.cache.has(tokens.roleIDs.voiceMuted);
		if (muted != newMember.voice.serverMute)
			newMember.voice.setMute(muted);

		// PROCESS AUTO-MANAGED CATEGORIES (adding/removing channels as needed)
		if (oldMember.voice.channel === newMember.voice.channel)
			return;

		var catProcessed: CategoryChannel = null;

		function processAutoManagedCategories(member: GuildMember)
		{
			if (!member)
				return;
			let vc = member.voice.channel;
			if (!vc)
				return;
			let cat = vc.parent;
			if (!cat || !(vc.parentID in tokens.autoManagedCategories) || cat === catProcessed)
				return;
			catProcessed = cat;
			let channelsForceRename = !voiceChannelsRenamed[vc.parentID];

			let names = tokens.autoManagedCategories[vc.parentID].names;
			if (!names)
				names = [ "Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu" ];

			let prefix = tokens.autoManagedCategories[vc.parentID].channelPrefix;
			let ignore = tokens.autoManagedCategories[vc.parentID].ignoredChannels || [];
			let channels = cat.children.array().filter(ch => ch.type === 'voice' && ignore.filter(ig => ig === ch.id).length === 0).map(ch => ({ channel: ch, members: ch.members.size }));
			channels.sort((c1, c2) => c1.channel.name < c2.channel.name ? -1 : c1.channel.name > c2.channel.name ? 1 : 0);

			let logmsg = `Channels are: ${channels.map(obj => `${obj.channel.name}=${obj.members}`).join(', ')}`;

			let numEmpty = channels.filter(ch => ch.members === 0).length;
			if (numEmpty < 1)
			{
				let ix = 0, name: string;
				function convert(i: number): string
				{
					return i < names.length ? names[i] : `${convert(((i / names.length)|0) - 1)} ${names[i % names.length]}`;
				}

				// Rename the 0th channel if it's different, or all channels if channelsForceRename is true
				if (channels.length === 1 || channelsForceRename)
				{
					for (; ix < channels.length; ix++)
					{
						if (channels[ix].channel.name !== `${prefix} ${convert(ix)}`)
							channels[ix].channel.setName(`${prefix} ${convert(ix)}`);
					}
					voiceChannelsRenamed[vc.parentID] = true;
				}

				// Create a new channel within this category
				do
				{
					name = `${prefix} ${convert(ix)}`;
					ix++;
				}
				while (channels.filter(ch => ch.channel.name === name).length > 0);

				logmsg += `; creating ${name}`;
				cat.guild.channels.create(name, {
					type: 'voice',
					reason: 'AutoManage: create new empty channel'
				})
					.then(newChannel => { newChannel.setParent(cat); })
					.catch(logger.error);
			}
			else if (numEmpty > 1)
			{
				// Delete unused channels in this category except the first one
				var oneFound = false;
				for (let i = 0; i < channels.length; i++)
				{
					if (channels[i].members === 0)
					{
						if (oneFound)
						{
							logmsg += `; deleting ${channels[i].channel.name}`;
							channels[i].channel.delete('AutoManage: delete unused channel');
						}
						else
							oneFound = true;
					}
				}
			}

			logger.info(logmsg);
		}

		processAutoManagedCategories(oldMember);
		processAutoManagedCategories(newMember);
	})
	.on("presenceUpdate", (oldMember, newMember) => {
		// Check any presence changes for a potential streamer
		checkStreamingStatus(newMember);
	})
	.on("messageReactionAdd", async (reaction, user) => await handleReaction(reaction, user, true))
	.on("messageReactionRemove", async (reaction, user) => await handleReaction(reaction, user, false));

client.registry
	.registerGroups([
		["public", "Public"],
		["administration", "Administration"]
	])
	.registerDefaultTypes()
	.registerDefaultGroups()
	.registerDefaultCommands({
		unknownCommand: false
	})
	.registerCommandsIn(path.join(__dirname, "commands"));

client.setProvider(
	sqlite.open({ filename: path.join(__dirname, "..", "database.sqlite3"), driver: sqlite3.cached.Database }).then(db => new commando.SQLiteProvider(db))
).catch(logger.error);

client.dispatcher.addInhibitor(msg =>
	msg.guild == null || (msg.channel.type == "text" && ["bot-commands", "staff-only", "audit-log", "mod-commands"].includes(msg.channel.name)) ||
	(msg.command != null && (msg.command.memberName == "refresh-rolemenu" || (msg.command.memberName == "agree" && msg.channel.type == "text" && msg.channel.name == "rules"))) ?
		false : "Commands are not allowed in this channel."
);

const videoBot = new WebhookClient(tokens.annoucementWebhook.id, tokens.annoucementWebhook.token);
let workshopScanner: WorkshopScanner;
sqlite.open({ filename: path.join(__dirname, "..", "database.sqlite3"), driver: sqlite3.cached.Database }).then(async db => workshopScanner = new WorkshopScanner(db, client));

function scheduledTask() {
	if (tokens.debugging) return;
	// Scan for new KTANE-related YouTube videos

	let videosAnnounced = client.provider.get("global", "videosAnnounced"), lastVideoScans = null;
	if (videosAnnounced === undefined)
	{
		logger.info("videosAnnounced is undefined");
		videosAnnounced = [];
	}
	else
		videosAnnounced = JSON.parse(videosAnnounced);

	let nowTime = new Date();
	for (let videoChannel of tokens.tutorialVideoChannels) {
		request({
			url: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=${tokens.youtubeAPIKey}`,
			json: true
		}, function(err, resp, json) {
			if (err) { logger.error(err); return; }
			if (resp.statusCode != 200) { logger.error(`Failed to get videos, status code: ${resp.statusCode}`); return; }

			for (let item of json.items.reverse()) {
				let snippet = item.snippet;
				if (videosAnnounced.includes(snippet.resourceId.videoId))
					continue;
				if (snippet.title.toLowerCase().indexOf("ktane") === -1 &&
					snippet.title.toLowerCase().indexOf("keep talking and nobody explodes") === -1)
					continue;
				videosAnnounced.push(snippet.resourceId.videoId);
				videoBot.send(`New video by ${videoChannel.mention}: **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`);
				logger.info(`Announced ${videoChannel.name} video ${snippet.title} (${snippet.resourceId.videoId}).`);
			}

			logger.info(`Video channel ${videoChannel.name} checked.`);
			client.provider.set("global", "videosAnnounced", JSON.stringify(videosAnnounced));
		});
	}
}

function checkStreamingStatus(member: GuildMember) {
	if (tokens.debugging) return;
    if (!member.presence) return;
	let activities = member.presence.activities;
	let streamingKTANE = activities.some(game => game.type === "STREAMING" && game.state === "Keep Talking and Nobody Explodes");
	let hasRole = member.roles.cache.has(tokens.roleIDs.streaming);
	let actionTaken = null;
	if (hasRole && !streamingKTANE)
	{
		member.roles.remove(tokens.roleIDs.streaming).catch(logger.error);
		actionTaken = '; removing streaming role';
	}
	else if (!hasRole && streamingKTANE)
	{
		member.roles.add(tokens.roleIDs.streaming).catch(logger.error);
		actionTaken = '; adding streaming role';
	}
	if (actionTaken !== null)
		logger.info(member.user.username, `${streamingKTANE ? "is streaming KTANE" : "is streaming NON-KTANE"}${actionTaken}`, activities);
}

async function handleReaction(reaction: MessageReaction, user: User, reactionAdded: boolean) {
	let channel: TextChannel = null;

	if (!await unpartial(reaction))
		return;

	const message = reaction.message;
	if (!await unpartial(message))
		return;

	let anyChannel = message.channel;
	if (anyChannel == null || anyChannel.type != "text") return;
	channel = anyChannel;

	const emojiKey = (reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;

	if (channel.id == "612414629179817985") {
		if (!reactionAdded || reaction.emoji.name != "solved" || message.pinned) return;

		message.delete().catch(logger.error);
	} else {
		for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus)) {
			const [channelID, msgID] = menuMessageID.split('/');
			if (msgID != message.id)
				continue;

			for (const [emojiName, roleID] of Object.entries(emojis)) {
				if (reaction.emoji.name != emojiName)
					continue;

				const guildMember = message.guild.member(user);
				if (reactionAdded) {
					guildMember.roles.add(roleID).catch(logger.error);
				} else {
					guildMember.roles.remove(roleID).catch(logger.error);
				}

				//*
				// Schedule or unschedule removing the role in two hours
				if (menuMessageID == "640560537205211146/640563515945385984" && user.id !== client.user.id) {
					if (reactionAdded) {
						TaskManager.addTask(Date.now() + 7200000, "removeReaction", {
							channelID: channel.id,
							messageID: message.id,
							userID: user.id,
							emojiKey: emojiKey
						});
					} else {
						TaskManager.removeTask("removeReaction", task => task.info.messageID == message.id && task.info.userID == user.id && task.info.emojiKey == emojiKey);
					}
				}
				/**/
			}
		}
	}
}

client.login(tokens.botToken);

// The math below is based on this equation: 10000 (quota limit) = 1440 (minutes in a day) / minutes * channels * 3 (each request is 3 quota), solved for the variable minutes.
// This is to prevent going over the YouTube API quota.
cron.schedule(`*/${Math.ceil(54 / 125 * tokens.tutorialVideoChannels.length) + 1} * * * *`, scheduledTask);

cron.schedule("*/1 * * * *", () => {
	// Scan another page for new mods or changes
	workshopScanner.run().catch((error: any) => logger.error("Unable to run workshop scan:", error));

	// Process tasks
	TaskManager.processTasks();
});