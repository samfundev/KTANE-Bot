const Discord = require("discord.js");
const commando = require("discord.js-commando");
const path = require("path");
const sqlite = require("sqlite");
const request = require("request");
const tokens = require("./tokens");

const streamingRoleID = "421415867381710859";

const client = new commando.Client({
	owner: "76052829285916672",
	commandPrefix: "!",
	nonCommandEditable: false,
	unknownCommandResponse: false
});

client
	.on("error", console.error)
	.on("warn", console.warn)
	.on("debug", console.log)
	.on("ready", () => {
		console.log(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`);
		checkVideos();
	})
	.on("disconnect", () => { console.warn("Disconnected!"); })
	.on("reconnecting", () => { console.warn("Reconnecting..."); })
	.on("commandError", (cmd, err) => {
		if(err instanceof commando.FriendlyError) return;
		console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on("message", (message) => {
		if (message.channel.name == "voice-text") {
			message.attachments.some(function(attachment) {
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
	});

client.setProvider(
	sqlite.open(path.join(__dirname, "database.sqlite3")).then(db => new commando.SQLiteProvider(db))
).catch(console.error);

client.registry
	.registerGroups([
		["profiles", "Profile Management"]
	])
	.registerDefaults()
	.registerCommandsIn(path.join(__dirname, "commands"));

const videoBot = new Discord.WebhookClient(tokens.annoucementWebhook.id, tokens.annoucementWebhook.token);
function scheduledTask() {
	// Scan for new tutorial videos by Elias
	request({
		url: "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=UUFJpcaokKY8uo_nXxAIkyjg&key=" + tokens.youtubeAPIKey,
		json: true
	}, function(err, resp, json) {
		if (err) { console.error(err); return; }
		if (resp.statusCode != 200) console.error(resp.statusCode);

		let lastTime = client.provider.get("global", "lastVideoScan");
		if (lastTime != undefined) {
			for (let item of json.items.reverse()) {
				let snippet = item.snippet;
				if (snippet.title.startsWith("KTANE - How to - ") && new Date(snippet.publishedAt).getTime() >= lastTime) {
					videoBot.send(`Elias uploaded a new tutorial **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`);
				}
			}

			client.provider.set("global", "lastVideoScan", Date.now());
		} else {
			console.error("Unable to get last scan time!");
		}
	});

	// Scan for new or ended KTANE streams
	client.guilds.forEach(guild => {
		if (!guild.available) return;

		guild.members.forEach(member => {
			let hasRole = member.roles.has(streamingRoleID);
			let game = member.presence.game;
			let streamingGame = (game && game.streaming && (game.name.toLowerCase().includes("keep talking and nobody explodes") || game.name.toLowerCase().includes("ktane")));
			if (game && game.streaming) console.log(game);
			if (hasRole && !streamingGame) member.removeRole(streamingRoleID).catch(console.error);
			else if (!hasRole && streamingGame) member.addRole(streamingRoleID).catch(console.error);
		});
	});
}
require("node-cron").schedule("*/5 * * * *", scheduledTask);

client.login(tokens.botToken);