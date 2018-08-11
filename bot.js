const Discord = require("discord.js");
const commando = require("discord.js-commando");
const path = require("path");
const sqlite = require("sqlite");
const request = require("request");
const tokens = require("./tokens");

const client = new commando.Client({
	owner: "76052829285916672",
	commandPrefix: "!",
	nonCommandEditable: false,
	unknownCommandResponse: false,
	fetchAllMembers: true
});

client
	.on("error", console.error)
	.on("warn", console.warn)
	.on("debug", console.log)
	.on("ready", () => console.log(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`))
	.on("providerReady", () => scheduledTask())
	.on("disconnect", () => { console.warn("Disconnected!"); })
	.on("reconnecting", () => { console.warn("Reconnecting..."); })
	.on("commandError", (cmd, err) => {
		if(err instanceof commando.FriendlyError) return;
		console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on("message", (message) => {
		if (message.channel.name == "voice-text") {
			message.attachments.some(attachment => {
				var file = attachment.filename;
				if (file.includes("output_log") || file.includes("Player.log")) {
					message.channel.send({
						embed: {
							"title": "Logfile Analyzer Link",
							"description": "[" + file + "](https://ktane.timwi.de/More/Logfile%20Analyzer.html#url=" + attachment.url + ")",
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
		if (muted != newMember.serverMute) newMember.setMute(false);
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
).catch(console.error);

client.dispatcher.addInhibitor(msg => msg.guild != null && !["bot-commands", "moderators-only", "admins-only"].includes(msg.channel.name) ? "Commands are not allowed in this channel." : false)

const videoBot = new Discord.WebhookClient(tokens.annoucementWebhook.id, tokens.annoucementWebhook.token);
function scheduledTask() {
	// Scan for new tutorial videos

	for (let videoChannel of tokens.tutorialVideoChannels) {
		request({
			url: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=${tokens.youtubeAPIKey}`,
			json: true
		}, function(err, resp, json) {
			if (err) { console.error(err); return; }
			if (resp.statusCode != 200) console.error(resp.statusCode);

			let lastVideoScans = client.provider.get("global", "lastVideoScans");
			if (lastVideoScans === undefined) {
				console.log("lastVideoScans is undefined");
				return;
			}
			lastVideoScans = JSON.parse(lastVideoScans);

			for (let item of json.items.reverse()) {
				let snippet = item.snippet;
				let time = new Date(snippet.publishedAt);
				let lastScan = (videoChannel.name in lastVideoScans) ? new Date(lastVideoScans[videoChannel.name]) : null;
				if (snippet.title.startsWith("KTANE - How to - ")) {
					if (lastScan === null || time.getTime() >= lastScan.getTime()) {
						videoBot.send(`New tutorial video by ${videoChannel.mention}: **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`);
						console.log(`Announced ${videoChannel.name} video ${snippet.title}.`);
					} else {
						console.log(`Not announcing ${videoChannel.name} video ${snippet.title} because time is ${time}; last scan was ${lastScan}.`);
					}
				}
			}

			console.log(`Video channel ${videoChannel.name} checked. Last check was ${lastVideoScans[videoChannel.name]}.`);
			lastVideoScans[videoChannel.name] = new Date();
			client.provider.set("global", "lastVideoScans", JSON.stringify(lastVideoScans));

		});
	}

	// Scan for new or ended KTANE streams
	client.guilds.forEach(guild => {
		if (!guild.available) return;

		guild.members.forEach(member => {
			let hasRole = member.roles.has(tokens.roleIDs.streaming);
			let game = member.presence.game;
			let streamingGame = (game && game.streaming && (game.name.toLowerCase().includes("keep talking and nobody explodes") || game.name.toLowerCase().includes("ktane")));
			if (game && game.streaming) console.log(game);
			if (hasRole && !streamingGame) member.removeRole(tokens.roleIDs.streamingRoleID).catch(console.error);
			else if (!hasRole && streamingGame) member.addRole(tokens.roleIDs.streamingRoleID).catch(console.error);
		});
	});
}

client.login(tokens.botToken);

require("node-cron").schedule("*/5 * * * *", scheduledTask);
