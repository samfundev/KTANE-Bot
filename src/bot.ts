#!/usr/bin/env node

import { SapphireClient, container } from "@sapphire/framework";
import { BaseGuildVoiceChannel, CategoryChannel, Intents, MessageReaction, PartialMessageReaction, PartialUser, Snowflake, TextChannel, User } from "discord.js";
import cron from "node-cron";
import { unpartial, update } from "./bot-utils";
import checkStreamingStatus from "./check-stream";
import { DB, DBKey } from "./db";
import tokens from "./get-tokens";
import { LFG } from "./lfg";
import Logger from "./log";
import lintMessage from "./repository/repolint";
import TaskManager from "./task-manager";
import { scanVideos, setupVideoTask } from "./video";
import WorkshopScanner from "./workshop";

export class KTANEClient extends SapphireClient {
	constructor() {
		super({
			defaultPrefix: "!",
			partials: ["MESSAGE", "REACTION", "CHANNEL"],
			intents: [
				Intents.FLAGS.GUILDS,
				Intents.FLAGS.GUILD_MESSAGES,
				Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
				Intents.FLAGS.GUILD_VOICE_STATES,
				Intents.FLAGS.GUILD_PRESENCES,

				Intents.FLAGS.DIRECT_MESSAGES
			]
		});
	}

	async login(token: string): Promise<string> {
		LFG.loadPlayers();
		setupVideoTask();

		return super.login(token);
	}

	destroy(): void {
		container.db.database.close();

		return super.destroy();
	}
}

container.db = new DB();

const client = new KTANEClient();

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

		if (container.db.get(DB.global, "updating", false)) {
			container.db.delete(DB.global, "updating");

			if (typeof container.ownerID == "string")
				client.users.fetch(container.ownerID).then(user => user.send("Update is complete.")).catch(Logger.errorPrefix("Failed to send updated message:"));
		}
	})
	.on("disconnect", () => { Logger.warn("Disconnected!"); })
	.on("messageCreate", async (message) => {
		if (!await unpartial(message))
			return;

		if (message.channel.type == "GUILD_NEWS") {
			message.crosspost().catch(Logger.errorPrefix("Automatic Crosspost"));
		} else if (message.channel.type == "GUILD_TEXT" && message.guild !== null) {
			const id = client.user?.id;
			const content = message.content.toLowerCase();
			const members = message.mentions.members;
			if (id !== undefined && members !== null && members.has(id) && content.includes("vote") && content.includes("run")) {
				await message.reply("There is no vote running.");
				return;
			}

			const requestsID = container.db.getOrUndefined<Snowflake>(message.guild, DBKey.RequestsChannel);

			if (message.channel.name.includes("voice-text")) {
				message.attachments.some(attachment => {
					const file = attachment.name;
					if (file != undefined && (file.includes("output_log") || file.includes("Player.log"))) {
						message.channel.send({
							embeds: [{
								"title": "Logfile Analyzer Link",
								"description": `[${file}](https://ktane.timwi.de/lfa#url=${attachment.url})`,
								"color": 1689625
							}]
						}).catch(Logger.errorPrefix("Failed to send LFA link:"));
						return true;
					}

					return false;
				});
			} else if (message.channel.id == requestsID) {
				await lintMessage(message);
			}
		}
	})
	.on("messageDelete", message => {
		if (message.channel.type == "GUILD_TEXT" && message.guild !== null) {
			const requestsID = container.db.getOrUndefined<Snowflake>(message.guild, DBKey.RequestsChannel);
			if (message.channel.id !== requestsID)
				return;
		} else if (message.channel.type !== "DM")
			return;

		const id = (message.channel.type == "GUILD_TEXT" && message.guild != null) ? message.guild.id : message.channel.id;
		update<Record<string, string>>(container.db, id, "reportMessages", {}, async (value) => {
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

		function processAutoManagedCategories(vc: BaseGuildVoiceChannel | null) {
			if (!vc)
				return;
			const cat = vc.parent;
			if (!cat || !vc.parentId || !(vc.parentId in tokens.autoManagedCategories) || cat === catProcessed)
				return;
			catProcessed = cat;
			const channelsForceRename = !voiceChannelsRenamed[vc.parentId];

			let names = tokens.autoManagedCategories[vc.parentId].names;
			if (names == null)
				names = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"];

			const prefix = tokens.autoManagedCategories[vc.parentId].channelPrefix;
			const ignore = tokens.autoManagedCategories[vc.parentId].ignoredChannels || [];
			const channels = [...cat.children.values()].filter(ch => ch.type === "GUILD_VOICE" && ignore.filter(ig => ig === ch.id).length === 0).map(ch => ({ channel: ch, members: ch.members.size }));
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
					voiceChannelsRenamed[vc.parentId] = true;
				}

				// Create a new channel within this category
				do {
					name = `${prefix} ${convert(ix, names)}`;
					ix++;
				}
				while (channels.filter(ch => ch.channel.name === name).length > 0);

				logmsg += `; creating ${name}`;
				cat.guild.channels.create(name, {
					type: "GUILD_VOICE",
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
							channels[i].channel.delete().catch(Logger.errorPrefix("Failed to delete channel:"));
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


const workshopScanner: WorkshopScanner = new WorkshopScanner();

async function handleReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, reactionAdded: boolean) {
	if (user.partial)
		return;

	// The bot is only reacting to show the options, it shouldn't actually be handled.
	if (user.id === client.user?.id)
		return;

	if (!await unpartial(reaction) || reaction.partial)
		return;

	const message = reaction.message;
	if (!await unpartial(message) || message.partial)
		return;

	const anyChannel = message.channel;
	if (anyChannel == null || anyChannel.type != "GUILD_TEXT" || message.guild == null) return;
	const channel: TextChannel = anyChannel;

	const emojiKey = (reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
	if (emojiKey == null)
		return;

	if (channel.id == "612414629179817985") {
		if (!reactionAdded || reaction.emoji.name != "solved" || message.pinned || !message.guild.members.cache.get(user.id)?.roles.cache.has(tokens.roleIDs.maintainer)) return;

		message.delete().catch(Logger.error);
	} else {
		for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus)) {
			const [, msgID] = menuMessageID.split("/");
			if (msgID != message.id)
				continue;

			for (const [emojiName, roleID] of Object.entries(emojis)) {
				if (reaction.emoji.name != emojiName)
					continue;

				const guildMember = message.guild.members.cache.get(user.id);
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

cron.schedule("*/1 * * * *", () => {
	// Scan another page for new mods or changes
	workshopScanner.run().catch((error: unknown) => Logger.error("Unable to run workshop scan:", error));

	// Process tasks
	TaskManager.processTasks();
});