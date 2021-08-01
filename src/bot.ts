#!/usr/bin/env node

import { AkairoClient, CommandHandler, InhibitorHandler, ListenerHandler, SQLiteProvider } from "discord-akairo";
import { CategoryChannel, Intents, MessageReaction, PartialUser, TextChannel, User, VoiceChannel } from "discord.js";
import cron from "node-cron";
import path from "path";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import { unpartial, update } from "./bot-utils";
import checkStreamingStatus from "./check-stream";
import { parseDuration } from "./duration";
import tokens from "./get-tokens";
import { parseLanguage } from "./language";
import { LFG } from "./lfg";
import Logger from "./log";
import lintMessage from "./repolint";
import TaskManager from "./task-manager";
import { scanVideos, setupVideoTask } from "./video";
import WorkshopScanner from "./workshop";

declare module "discord-akairo" {
	interface AkairoClient {
		commandHandler: CommandHandler;
		inhibitorHandler: InhibitorHandler;
		listenerHandler: ListenerHandler;
		settings: SQLiteProvider;
	}
}

export class KTANEClient extends AkairoClient {
	constructor() {
		super({
			ownerID: "76052829285916672",
		}, {
			partials: ["MESSAGE", "REACTION"],
			ws: {
				intents: [Intents.NON_PRIVILEGED, "GUILD_PRESENCES"]
			}
		});

		this.commandHandler = new CommandHandler(this, {
			directory: path.join(__dirname, "commands"),
			prefix: "!",
			handleEdits: true,
			commandUtil: true
		});

		this.commandHandler.resolver.addType("duration", (message, phrase) => {
			return parseDuration(phrase);
		});

		this.commandHandler.resolver.addType("language", (message, phrase) => {
			return parseLanguage(phrase);
		});

		this.commandHandler.loadAll();

		this.inhibitorHandler = new InhibitorHandler(this, {
			directory: path.join(__dirname, "inhibitors")
		});

		this.commandHandler.useInhibitorHandler(this.inhibitorHandler);
		this.inhibitorHandler.loadAll();

		this.listenerHandler = new ListenerHandler(this, {
			directory: path.join(__dirname, "listeners")
		});

		this.commandHandler.useListenerHandler(this.listenerHandler);
		this.listenerHandler.setEmitters({
			commandHandler: this.commandHandler
		});
		this.listenerHandler.loadAll();

		this.settings = new SQLiteProvider(sqlite.open({ filename: path.join(__dirname, "..", "database.sqlite3"), driver: sqlite3.cached.Database }), "settings", {
			dataColumn: "settings"
		});
	}

	static instance: KTANEClient;

	async login(token: string) {
		await this.settings.init();
		LFG.loadPlayers();
		return super.login(token);
	}
}

const client = new KTANEClient();

KTANEClient.instance = client;

const voiceChannelsRenamed: { [id: string]: boolean } = {};

client
	.on("error", Logger.error)
	.on("warn", Logger.warn)
	.on("debug", Logger.info)
	.on("ready", () => {
		if (!client.user)
			return;

		Logger.info(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client?.user.id})`);

		scanVideos().catch(Logger.errorPrefix("Failed to scan videos:"));

		if (client.settings.get("global", "updating", false)) {
			client.settings.delete("global", "updating").catch(Logger.errorPrefix("Failed to delete updating state:"));

			if (typeof client.ownerID == "string")
				client.users.fetch(client.ownerID).then(user => user.send("Update is complete.")).catch(Logger.errorPrefix("Failed to send updated message:"));
		}
	})
	.on("disconnect", () => { Logger.warn("Disconnected!"); })
	.on("message", async (message) => {
		if (!await unpartial(message))
			return;

		if (message.channel.type == "news") {
			message.crosspost().catch(Logger.errorPrefix("Automatic Crosspost"));
		} else if (message.channel.type == "text") {
			const id = client.user?.id;
			const content = message.content.toLowerCase();
			const members = message.mentions.members;
			if (id !== undefined && members !== null && members.has(id) && content.includes("vote") && content.includes("run"))
			{
				await message.reply("There is no vote running.");
				return;
			}

			if (message.channel.name.includes("voice-text")) {
				message.attachments.some(attachment => {
					const file = attachment.name;
					if (file != undefined && (file.includes("output_log") || file.includes("Player.log"))) {
						message.channel.send({
							embed: {
								"title": "Logfile Analyzer Link",
								"description": `[${file}](https://ktane.timwi.de/lfa#url=${attachment.url})`,
								"color": 1689625
							}
						}).catch(Logger.errorPrefix("Failed to send LFA link:"));
						return true;
					}

					return false;
				});
			} else if (message.channel.id == tokens.requestsChannel) {
				await lintMessage(message, client);
			}
		}
	})
	.on("messageDelete", message => {
		if ((message.channel.type !== "text" || message.channel.id !== tokens.requestsChannel) && message.channel.type !== "dm")
			return;

		const id = (message.channel.type == "text" && message.guild != null) ? message.guild.id : message.channel.id;
		update<Record<string, string>>(client.settings, id, "reportMessages", {}, async (value) => {
			const reportID = value[message.id];
			if (reportID === undefined)
				return value;

			delete value[message.id];

			await message.channel.messages.delete(reportID);

			return value;
		}).catch(Logger.errorPrefix("Failed to delete report."));
	})
	.on("voiceStateUpdate", async (oldState, newState) => {
		if (!oldState)
			return;

		const oldMember = oldState.member;
		const newMember = newState.member;

		if (!oldMember || !newMember)
			return;

		// VOICE-MUTING
		const muteRole = newMember.roles.cache.has(tokens.roleIDs.voiceMuted);
		if (oldState.serverMute != newState.serverMute) {
			if (newState.serverMute && !muteRole)
				await newMember.roles.add(tokens.roleIDs.voiceMuted);
			else if (!newState.serverMute && muteRole)
				await newMember.roles.remove(tokens.roleIDs.voiceMuted);
		}
		else if (muteRole != newState.serverMute)
			await newMember.voice.setMute(muteRole);

		// PROCESS AUTO-MANAGED CATEGORIES (adding/removing channels as needed)
		if (oldState.channel === newState.channel)
			return;

		let catProcessed: CategoryChannel;

		function convert(i: number, names: string[]): string {
			return i < names.length ? names[i] : `${convert(((i / names.length) | 0) - 1, names)} ${names[i % names.length]}`;
		}

		function processAutoManagedCategories(vc: VoiceChannel | null) {
			if (!vc)
				return;
			const cat = vc.parent;
			if (!cat || !vc.parentID || !(vc.parentID in tokens.autoManagedCategories) || cat === catProcessed)
				return;
			catProcessed = cat;
			const channelsForceRename = !voiceChannelsRenamed[vc.parentID];

			let names = tokens.autoManagedCategories[vc.parentID].names;
			if (names == null)
				names = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"];

			const prefix = tokens.autoManagedCategories[vc.parentID].channelPrefix;
			const ignore = tokens.autoManagedCategories[vc.parentID].ignoredChannels || [];
			const channels = cat.children.array().filter(ch => ch.type === "voice" && ignore.filter(ig => ig === ch.id).length === 0).map(ch => ({ channel: ch, members: ch.members.size }));
			channels.sort((c1, c2) => c1.channel.name < c2.channel.name ? -1 : c1.channel.name > c2.channel.name ? 1 : 0);

			let logmsg = `Channels are: ${channels.map(obj => `${obj.channel.name}=${obj.members}`).join(", ")}`;

			const numEmpty = channels.filter(ch => ch.members === 0).length;
			if (numEmpty < 1) {
				let ix = 0, name: string;
				// Rename the 0th channel if it's different, or all channels if channelsForceRename is true
				if (channels.length === 1 || channelsForceRename) {
					for (; ix < channels.length; ix++) {
						if (channels[ix].channel.name !== `${prefix} ${convert(ix, names)}`)
							channels[ix].channel.setName(`${prefix} ${convert(ix, names)}`).catch(Logger.errorPrefix("Failed to set channel name:"));
					}
					voiceChannelsRenamed[vc.parentID] = true;
				}

				// Create a new channel within this category
				do {
					name = `${prefix} ${convert(ix, names)}`;
					ix++;
				}
				while (channels.filter(ch => ch.channel.name === name).length > 0);

				logmsg += `; creating ${name}`;
				cat.guild.channels.create(name, {
					type: "voice",
					reason: "AutoManage: create new empty channel",
					parent: cat
				})
					.catch(Logger.error);
			}
			else if (numEmpty > 1) {
				// Delete unused channels in this category except the first one
				let oneFound = false;
				for (let i = 0; i < channels.length; i++) {
					if (channels[i].members === 0) {
						if (oneFound) {
							logmsg += `; deleting ${channels[i].channel.name}`;
							channels[i].channel.delete("AutoManage: delete unused channel").catch(Logger.errorPrefix("Failed to delete channel:"));
						}
						else
							oneFound = true;
					}
				}
			}

			Logger.info(logmsg);
		}

		processAutoManagedCategories(oldState.channel);
		processAutoManagedCategories(newState.channel);
	})
	.on("presenceUpdate", (_, newPresence) => {
		// Check any presence changes for a potential streamer
		checkStreamingStatus(newPresence, true).catch(Logger.errorPrefix("checkStreamingStatus"));
	})
	.on("messageReactionAdd", async (reaction, user) => await handleReaction(reaction, user, true))
	.on("messageReactionRemove", async (reaction, user) => await handleReaction(reaction, user, false));


let workshopScanner: WorkshopScanner;
sqlite.open({ filename: path.join(__dirname, "..", "database.sqlite3"), driver: sqlite3.cached.Database }).then(db => workshopScanner = new WorkshopScanner(db, client)).catch(Logger.errorPrefix("Failed to load database:"));

async function handleReaction(reaction: MessageReaction, user: User | PartialUser, reactionAdded: boolean) {
	if (user.partial)
		return;

	// The bot is only reacting to show the options, it shouldn't actually be handled.
	if (user.id === client.user?.id)
		return;

	if (!await unpartial(reaction))
		return;

	const message = reaction.message;
	if (!await unpartial(message))
		return;

	const anyChannel = message.channel;
	if (anyChannel == null || anyChannel.type != "text" || message.guild == null) return;
	const channel: TextChannel = anyChannel;

	const emojiKey = (reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;

	if (channel.id == "612414629179817985") {
		if (!reactionAdded || reaction.emoji.name != "solved" || message.pinned || !message.guild.member(user)?.roles.cache.has(tokens.roleIDs.maintainer)) return;

		message.delete().catch(Logger.error);
	} else {
		for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus)) {
			const [, msgID] = menuMessageID.split("/");
			if (msgID != message.id)
				continue;

			for (const [emojiName, roleID] of Object.entries(emojis)) {
				if (reaction.emoji.name != emojiName)
					continue;

				const guildMember = message.guild.member(user);
				if (!guildMember)
					return;

				if (reactionAdded) {
					guildMember.roles.add(roleID).catch(Logger.error);
				} else {
					guildMember.roles.remove(roleID).catch(Logger.error);
				}

				//*
				// Schedule or unschedule removing the role in two hours
				if (menuMessageID == "640560537205211146/640563515945385984" && client.user && user.id !== client.user.id) {
					if (reactionAdded) {
						TaskManager.addTask({
							timestamp: Date.now() + 7200000,
							type: "removeReaction",
							channelID: channel.id,
							messageID: message.id,
							userID: user.id,
							emojiKey: emojiKey
						});
					} else {
						TaskManager.removeTask("removeReaction", task => task.messageID == message.id && task.userID == user.id && task.emojiKey == emojiKey);
					}
				}
				/**/
			}
		}
	}
}

client.login(tokens.botToken).catch(Logger.errorPrefix("Failed to login:"));

setupVideoTask();

cron.schedule("*/1 * * * *", () => {
	// Scan another page for new mods or changes
	workshopScanner.run().catch((error: unknown) => Logger.error("Unable to run workshop scan:", error));

	// Process tasks
	TaskManager.processTasks();
});