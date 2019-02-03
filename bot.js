const Discord = require("discord.js");
const commando = require("discord.js-commando");
const path = require("path");
const sqlite = require("sqlite");
const request = require("request");
const logger = require("./log");
const tokens = require("./tokens");

const client = new commando.Client({
	owner: "76052829285916672",
	commandPrefix: "!",
	nonCommandEditable: false,
	unknownCommandResponse: false,
	fetchAllMembers: true
});

client
	.on("error", logger.error)
	.on("warn", logger.warn)
	.on("debug", logger.info)
	.on("ready", () => logger.info(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`))
	.on("providerReady", () => scheduledTask())
	.on("disconnect", () => { logger.warn("Disconnected!"); })
	.on("reconnecting", () => { logger.warn("Reconnecting..."); })
	.on("commandError", (cmd, err) => {
		if(err instanceof commando.FriendlyError) return;
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
		}
	})
	.on("voiceStateUpdate", (_, newMember) => {
		let muted = newMember.roles.has(tokens.roleIDs.voiceMuted);
		if (muted != newMember.serverMute)
			newMember.setMute(muted);
	});

client.registry
	.registerGroups([
		["public", "Public"],
		["administration", "Administration"]
	])
	.registerDefaults()
	.registerCommandsIn(path.join(__dirname, "commands"));

client.setProvider(
	sqlite.open(path.join(__dirname, "database.sqlite3")).then(db => new commando.SQLiteProvider(db))
).catch(logger.error);

client.dispatcher.addInhibitor(msg => msg.guild != null && !["bot-commands", "staff-only", "audit-log", "bot-test"].includes(msg.channel.name) ? "Commands are not allowed in this channel." : false)

const videoBot = new Discord.WebhookClient(tokens.annoucementWebhook.id, tokens.annoucementWebhook.token);
function scheduledTask() {
	// Scan for new tutorial videos

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
			lastVideoScans[videoChannel.name] = new Date();
			client.provider.set("global", "lastVideoScans", JSON.stringify(lastVideoScans));
		});
	}

	// Scan for new or ended KTANE streams
	client.guilds.forEach(guild => {
		if (!guild.available) return;

		guild.members.forEach(member => {
			let game = member.presence.game;
			let streamingKTANE = game && game.streaming && (
				(game.name + game.details).toLowerCase().includes("keep talking and nobody explodes") ||
				(game.name + game.details).toLowerCase().includes("ktane"));
			let hasRole = member.roles.has(tokens.roleIDs.streaming);
			if (game && game.streaming)
				logger.info(member.name, streamingKTANE ? "is streaming KTANE" : "is streaming NON-KTANE", game, hasRole ? "has role" : "does not have role");
			if (hasRole && !streamingKTANE)
				member.removeRole(tokens.roleIDs.streaming).catch(logger.error);
			else if (!hasRole && streamingKTANE)
				member.addRole(tokens.roleIDs.streaming).catch(logger.error);
		});
	});
}

client.login(tokens.botToken);

require("node-cron").schedule("*/5 * * * *", scheduledTask);
