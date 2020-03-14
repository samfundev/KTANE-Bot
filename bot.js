const Discord = require("discord.js");
const commando = require("discord.js-commando");
const cron = require("node-cron");
const path = require("path");
const sqlite = require("sqlite");
const request = require("request");
const logger = require("./log");
const WorkshopScanner = require("./workshop");
const tokens = require("./tokens");

const client = new commando.Client({
	owner: "76052829285916672",
	commandPrefix: "!",
	nonCommandEditable: false,
	unknownCommandResponse: false,
	fetchAllMembers: true
});

let voiceText = null;				// #voice-text text channel
let screensharingLinksPosted = {};	// indexed by Snowflake

client
	.on("error", logger.error)
	.on("warn", logger.warn)
	.on("debug", logger.info)
	.on("ready", () => {
		logger.info(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`)

		// Scan for new or ended KTANE streams to catch anyone before we started up
		client.guilds.forEach(guild => {
			if (!guild.available)
				return;

			guild.members.forEach(checkStreamingStatus);
			guild.channels.forEach(channel => {
				if (channel.name === 'voice-text' && channel.type === 'text')
					voiceText = channel;
			});
		});
	})
	.on("providerReady", () => {
		scheduledTask();

		if (client.provider.get("global", "updating", false)) {
			client.provider.remove("global", "updating");

			client.fetchUser(client.owners[0].id).then(user => user.send("Update is complete."));
		}
	})
	.on("disconnect", () => { logger.warn("Disconnected!"); })
	.on("reconnecting", () => { logger.warn("Reconnecting..."); })
	.on("commandError", (cmd, err) => {
		if (err instanceof commando.FriendlyError) return;
		logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on("message", (message) => {
		if (message.channel.name == "voice-text") {
			message.attachments.some(attachment => {
				var file = attachment.filename;
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
			if (message.member.highestRole.comparePositionTo(message.guild.roles.get(tokens.roleIDs.moderator)) >= 0)
				return;

			message.delete().catch(logger.error);
		}
	})
	.on("voiceStateUpdate", (oldMember, newMember) => {

		// VOICE-MUTING
		let muted = newMember.roles.has(tokens.roleIDs.voiceMuted);
		if (muted != newMember.serverMute)
			newMember.setMute(muted);

		// PROCESS AUTO-MANAGED CATEGORIES (adding/removing channels as needed)
		if (oldMember.voiceChannel === newMember.voiceChannel)
			return;

		var catProcessed = null;

		function processAutoManagedCategories(member)
		{
			if (!member)
				return;
			let vc = member.voiceChannel;
			if (!vc)
				return;
			let cat = vc.parent;
			if (!cat || !(vc.parentID in tokens.autoManagedCategories) || cat === catProcessed)
				return;
			catProcessed = cat;

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
				let ix = 0, name;
				function convert(i)
				{
					return i < names.length ? names[i] : `${convert(((i / names.length)|0) - 1)} ${names[i % names.length]}`;
				}

				// Rename the 0th channel if it's different
				if (channels.length === 1 && channels[0].channel.name !== `${prefix} ${convert(0)}`)
				{
					channels[0].channel.setName(`${prefix} ${convert(0)}`);
					ix = 1;
				}

				// Create a new channel within this category
				do
				{
					name = `${prefix} ${convert(ix)}`;
					ix++;
				}
				while (channels.filter(ch => ch.channel.name === name).length > 0);

				logmsg += `; creating ${name}`;
				cat.guild.createChannel(name, {
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
							if (channels[i].channel.id in screensharingLinksPosted)
								delete screensharingLinksPosted[channels[i].channel.id];
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

		if (newMember && newMember.voiceChannel && !(newMember.voiceChannel.id in screensharingLinksPosted) && (newMember.voiceChannel.parentID in tokens.autoManagedCategories))
		{
			screensharingLinksPosted[newMember.voiceChannel.id] = true;
			voiceText.send(`${newMember.voiceChannel.name} screen-sharing link: <http://www.discordapp.com/channels/${newMember.voiceChannel.guild.id}/${newMember.voiceChannel.id}>`);
		}
	})
	.on("presenceUpdate", (oldMember, newMember) => {
		// Check any presence changes for a potential streamer
		checkStreamingStatus(newMember);
	})
	.on("raw", async event => {
		if (event.t == "MESSAGE_REACTION_ADD" || event.t == "MESSAGE_REACTION_REMOVE")
		{
			const reactionAdded = event.t == "MESSAGE_REACTION_ADD";
			const { d: data } = event;
			const user = client.users.get(data.user_id);
			const channel = client.channels.get(data.channel_id);

			if (channel == null || channel.type != "text") return;

			const message = await channel.fetchMessage(data.message_id);
			const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
			let reaction = message.reactions.get(emojiKey);

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
							guildMember.addRole(roleID).catch(logger.error);
						} else {
							guildMember.removeRole(roleID).catch(logger.error);
						}

						//*
						// Schedule or unschedule removing the role in two hours
						if (menuMessageID == "640560537205211146/640563515945385984" && data.user_id !== client.user.id) {
							let scheduledTasks = client.provider.get("global", "scheduledTasks", []);

							if (reactionAdded) {
								scheduledTasks.push(new ScheduledTask(Date.now() + 7200000, "removeReaction", {
									channelID: data.channel_id,
									messageID: data.message_id,
									userID: data.user_id,
									emojiKey: emojiKey
								}));
							} else {
								scheduledTasks = scheduledTasks.filter(task => !(task.info.messageID == data.message_id && task.info.userID == data.user_id && task.info.emojiKey == emojiKey));
							}

							client.provider.set("global", "scheduledTasks", scheduledTasks);
						}
						/**/
					}
				}
			}
		}
	});

client.registry
	.registerGroups([
		["public", "Public"],
		["administration", "Administration"]
	])
	.registerDefaults()
	.registerCommandsIn(path.join(__dirname, "commands"));

client.setProvider(
	sqlite.open(path.join(__dirname, "database.sqlite3"), { cached: true }).then(db => new commando.SQLiteProvider(db))
).catch(logger.error);

client.dispatcher.addInhibitor(msg =>
	msg.guild == null || ["bot-commands", "staff-only", "audit-log", "mod-commands"].includes(msg.channel.name) ||
	(msg.command != null && (msg.command.memberName == "refresh-rolemenu" || (msg.command.memberName == "agree" && msg.channel.name == "rules"))) ?
		false : "Commands are not allowed in this channel."
);

const videoBot = new Discord.WebhookClient(tokens.annoucementWebhook.id, tokens.annoucementWebhook.token);
let workshopScanner;
sqlite.open(path.join(__dirname, "database.sqlite3"), { cached: true }).then(async db => workshopScanner = new WorkshopScanner(db));

class ScheduledTask {
	constructor(timestamp, type, info) {
		this.timestamp = timestamp;
		this.type = type;
		this.info = info;
	}
}

function scheduledTask() {
	// Scan for new tutorial videos
	let nowTime = new Date();
	for (let videoChannel of tokens.tutorialVideoChannels) {
		request({
			url: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=${tokens.youtubeAPIKey}`,
			json: true
		}, function(err, resp, json) {
			if (err) { logger.error(err); return; }
			if (resp.statusCode != 200) { logger.error(`Failed to get videos, status code: ${resp.statusCode}`); return; }

			let lastVideoScans = client.provider.get("global", "lastVideoScans");
			if (lastVideoScans === undefined) {
				logger.info("lastVideoScans is undefined");
				return;
			}
			lastVideoScans = JSON.parse(lastVideoScans);

			for (let item of json.items.reverse()) {
				let snippet = item.snippet;
				let time = new Date(snippet.publishedAt);
				let lastScan = (videoChannel.name in lastVideoScans) ? new Date(lastVideoScans[videoChannel.name]) : null;
				if (snippet.title.toLowerCase().indexOf("ktane") !== -1 ||
					snippet.title.toLowerCase().indexOf("keep talking and nobody explodes") !== -1) {
					if (lastScan === null || time.getTime() >= lastScan.getTime()) {
						videoBot.send(`New video by ${videoChannel.mention}: **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`);
						logger.info(`Announced ${videoChannel.name} video ${snippet.title}.`);
					} else {
						logger.info(`Not announcing ${videoChannel.name} video ${snippet.title} because time is ${time}; last scan was ${lastScan}.`);
					}
				}
			}

			logger.info(`Video channel ${videoChannel.name} checked. Last check was ${lastVideoScans[videoChannel.name]}.`);
			lastVideoScans[videoChannel.name] = nowTime;
			client.provider.set("global", "lastVideoScans", JSON.stringify(lastVideoScans));
		});
	}
}

function checkStreamingStatus(member) {
	let game = member.presence.game;
	let streamingKTANE = game && game.streaming && (
		(game.name + game.details).toLowerCase().includes("keep talking and nobody explodes") ||
		(game.name + game.details).toLowerCase().includes("ktane"));
	let hasRole = member.roles.has(tokens.roleIDs.streaming);
	let actionTaken = null;
	if (hasRole && !streamingKTANE)
	{
		member.removeRole(tokens.roleIDs.streaming).catch(logger.error);
		actionTaken = '; removing streaming role';
	}
	else if (!hasRole && streamingKTANE)
	{
		member.addRole(tokens.roleIDs.streaming).catch(logger.error);
		actionTaken = '; adding streaming role';
	}
	if (actionTaken !== null)
		logger.info(member.user.username, `${streamingKTANE ? "is streaming KTANE" : "is streaming NON-KTANE"}${actionTaken}`, game);
}

client.login(tokens.botToken);

// The math below is based on this equation: 10000 (quota limit) = 1440 (minutes in a day) / minutes * channels * 3 (each request is 3 quota), solved for the variable minutes.
// This is to prevent going over the YouTube API quota.
cron.schedule(`*/${Math.ceil(54 / 125 * tokens.tutorialVideoChannels.length) + 1} * * * *`, scheduledTask);

cron.schedule("*/1 * * * *", () => {
	// Scan another page for new mods or changes
	workshopScanner.run().catch(error => logger.error("Unable to run workshop scan:", error));

	// Remove roles after 2 hours
	let scheduledTasks = client.provider.get("global", "scheduledTasks", []);

	if (scheduledTasks.length == 0)
		return;

	scheduledTasks = scheduledTasks.filter(task => {
		if (task.timestamp > Date.now())
			return true;

		const info = task.info;

		switch (task.type) {
		case "removeReaction":
			client.channels.get(info.channelID).fetchMessage(info.messageID).then(message => {
				message.reactions.get(info.emojiKey).remove(info.userID).catch(logger.error);
			});
			break;
		default:
			logger.error("Unknown task type: " + task.type);
			break;
		}

		return false;
	});

	client.provider.set("global", "scheduledTasks", scheduledTasks);
});