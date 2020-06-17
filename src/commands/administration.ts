const Discord = require("discord.js");
import { Command, CommandoClient, CommandoMessage } from "discord.js-commando"
import { GuildMember, Guild, TextChannel } from 'discord.js';
import tokens from "get-tokens";
import logger from "log";
import TaskManager from "task-manager";
import sqlite from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
const { execSync } = require("child_process");
const { elevate } = require("node-windows");

// All of these are in minutes.
const durations: {[index: string]: number} = {
	h: 60,
	d: 1440,
	w: 10080,
	m: 43830,
}

function parseDuration(string: string) {
	const matches = /(\d+(?:\.\d+)?)([a-z])/.exec(string);
	if (matches == null || !durations.hasOwnProperty(matches[2]))
		return null;

	return 1000 * 60 * durations[matches[2]] * parseFloat(matches[1]);
}

interface TargetedArguments {
	target: GuildMember;
	duration: string;
}

export = [
	class MuteCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "mute",
				aliases: ["mute", "m"],
				group: "administration",
				memberName: "mute",
				description: "Toggles if someone is allowed to speak in text and voice channels.",
				examples: ["mute <name> (duration)", "m <user> (duration)"],
				guildOnly: true,

				args: [
					{
						key: "target",
						prompt: "Who should be muted?",
						type: "member"
					},
					{
						key: "duration",
						prompt: "How long?",
						type: "string",
						default: ""
					},
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.hasPermission("MUTE_MEMBERS");
		}

		run(msg: CommandoMessage, args: TargetedArguments) {
			if (args.target.roles.highest.comparePositionTo(msg.member.roles.highest) < 0) {
				let muted = args.target.roles.cache.has(tokens.roleIDs.voiceMuted);

				const duration = parseDuration(args.duration);
				if (args.duration != "" && duration == null) {
					return msg.reply("That's an invalid duration.");
				}

				if (muted) {
					args.target.roles.remove(tokens.roleIDs.voiceMuted)
						.then(() => {
							TaskManager.removeTask("removeRole", task => task.info.roleID == tokens.roleIDs.voiceMuted && task.info.memberID == args.target.id);
							return msg.reply(`${args.target.user.username} has been unmuted.`);
						})
						.catch(error => { console.log(error); msg.reply("Unable to unmute."); });
					
				} else {
					args.target.roles.remove(tokens.roleIDs.voiceMuted)
						.then(() => msg.reply(`${args.target.user.username} has been muted.`))
						.catch(error => { console.log(error); msg.reply("Unable to mute."); });
					
					TaskManager.addTask(Date.now(), "removeRole", { roleID: tokens.roleIDs.voiceMuted, memberID: args.target.id, guildID: msg.guild.id });
				}

				if (args.target.voice.channel) args.target.voice.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
			} else return msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
		}
	},
	class ReactionCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "reaction",
				aliases: ["reaction", "react"],
				group: "administration",
				memberName: "reaction",
				description: "Toggles if someone is allowed to react.",
				examples: ["reaction <name> (duration)", "react <user> (duration)"],
				guildOnly: true,

				args: [
					{
						key: "target",
						prompt: "Who should be allowed/prevented from reacting?",
						type: "member"
					},
					{
						key: "duration",
						prompt: "How long?",
						type: "string",
						default: ""
					},
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.hasPermission("MUTE_MEMBERS");
		}

		run(msg: CommandoMessage, args: TargetedArguments) {
			if (args.target.roles.highest.comparePositionTo(msg.member.roles.highest) < 0) {
				let noReaction = args.target.roles.cache.has(tokens.roleIDs.noReaction);

				const duration = parseDuration(args.duration);
				if (args.duration != "" && duration == null) {
					return msg.reply("That's an invalid duration.");
				}

				if (noReaction) {
					args.target.roles.remove(tokens.roleIDs.noReaction)
						.then(() => msg.reply(`${args.target.user.username} has been allowed to react.`))
						.catch(error => { console.log(error); msg.reply("Unable to remove role."); });
					
					TaskManager.removeTask("removeRole", task => task.info.roleID == tokens.roleIDs.noReaction && task.info.memberID == args.target.id)
				} else {
					args.target.roles.add(tokens.roleIDs.noReaction)
						.then(() => msg.reply(`${args.target.user.username} has been prevented from reacting.`))
						.catch(error => { console.log(error); msg.reply("Unable to add role."); });
					
					TaskManager.addTask(Date.now(), "removeRole", { roleID: tokens.roleIDs.noReaction, memberID: args.target.id, guildID: msg.guild.id });
				}
			} else msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
		}
	},
	class BanCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "ban",
				aliases: ["ban", "b"],
				group: "administration",
				memberName: "ban",
				description: "Bans someone for a specified duration.",
				examples: ["ban <user> <duration>", "b <user> <duration>"],
				guildOnly: true,

				args: [
					{
						key: "target",
						prompt: "Who should be banned?",
						type: "member"
					},
					{
						key: "duration",
						prompt: "How long?",
						type: "string"
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.hasPermission("BAN_MEMBERS");
		}

		run(msg: CommandoMessage, args: TargetedArguments) {
			const duration = parseDuration(args.duration);
			if (duration == null) {
				return msg.reply("That's an invalid duration.");
			}

			return args.target.ban()
				.then(() => {
					TaskManager.addTask(Date.now() + duration, "unbanMember", { guildID: msg.guild.id, memberID: args.target.id });
					return msg.reply("The user has been banned.");
				})
				.catch(logger.error);
		}
	},
	class ToggleRoleCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "toggle-role",
				aliases: ["togglerole", "tr"],
				group: "administration",
				memberName: "toggle-role",
				description: "Toggles a role for a user.",
				examples: ["togglerole <user> <role>", "tg <user> <role>"],
				guildOnly: true,

				args: [
					{
						key: "target",
						prompt: "Who should get the role?",
						type: "member"
					},
					{
						key: "role",
						prompt: "What role do you want to toggle?",
						type: "string"
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.roles.highest.comparePositionTo(msg.guild.roles.cache.get(tokens.roleIDs.moderator)) >= 0;
		}

		async run(msg: CommandoMessage, args: { target: GuildMember, role: string }) {
			const targetRole = args.role.toLowerCase();
			for (let roleData of tokens.roleIDs.modAssignable) {
				if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
					const role = msg.guild.roles.cache.get(roleData.roleID);
					if (role == undefined) {
						logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
						return;
					}

					if (args.target.roles.cache.has(roleData.roleID)) {
						return args.target.roles.remove(role)
							.then(() => msg.channel.send(`Removed the "${role.name}" role from ${args.target.user.username}.`))
							.catch(logger.error);
					} else {
						return args.target.roles.add(role)
							.then(() => msg.channel.send(`Gave the "${role.name}" role to ${args.target.user.username}.`))
							.catch(logger.error);
					}
				}
			}
		}
	},
	class SetSteamIDCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "set-steam-id",
				aliases: ["setsteamid", "setid"],
				group: "administration",
				memberName: "set-steam-id",
				description: "Sets a Steam ID to Discord ID pair for the announcements.",
				examples: ["setsteamid <steam-id> <discord-id>", "setid <steam-id> <discord-id>"],
				guildOnly: true,

				args: [
					{
						key: "steamid",
						prompt: "What is the steam ID?",
						type: "string"
					},
					{
						key: "discordid",
						prompt: "What is the discord ID?",
						type: "string"
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.roles.highest.comparePositionTo(msg.guild.roles.cache.get(tokens.roleIDs.moderator)) >= 0;
		}

		run(msg: CommandoMessage, args: { steamid: string, discordid: string }) {
			return sqlite.open({ filename: path.join(__dirname, "..", "..", "database.sqlite3"), driver: sqlite3.cached.Database })
				.then(db => db.run("INSERT INTO 'author_lookup' (steam_id, discord_id) VALUES(?, ?) ON CONFLICT(steam_id) DO UPDATE SET discord_id=excluded.discord_id", args.steamid, args.discordid))
				.then(() => msg.reply(`Set "${args.steamid}" to "${args.discordid}".`))
				.catch(error => { logger.error(error); return msg.reply("Failed to set."); });
		}
	},
	class RefreshRoleMenuCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "refresh-rolemenu",
				aliases: ["refreshrm", "refreshrolemenu"],
				group: "administration",
				memberName: "refresh-rolemenu",
				description: "Refreshes a role menu.",
				examples: ["refreshrm"],
				guildOnly: true,
				ownerOnly: true
			});
		}

		run(msg: CommandoMessage) {
			for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus))
			{
				const [channelID, msgID] = menuMessageID.split('/');
				let channel = msg.guild.channels.cache.get(channelID) as TextChannel;
				if (!channel)
				{
					logger.error(`Cannot find channel ${channelID}. Channels are:`);
					for (let [key, value] of msg.guild.channels.cache)
						logger.error(` -- ${key} = ${value}`)
					continue;
				}
				channel.messages.fetch(msgID)
					.then(async(message) => {
						for (const emojiName in emojis)
							await message.react(emojiName);
					})
					.catch(logger.error);
			}
			msg.delete().catch(logger.error);

			return Promise.resolve(null);
		}
	},
	class MakeMajorCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "make-major",
				aliases: ["makemajor", "mm"],
				group: "administration",
				memberName: "make-major",
				description: "Makes a minor announcement message a major announcement.",
				examples: ["makemajor <message-id>"],
				guildOnly: true,

				args: [
					{
						key: "messageid",
						prompt: "What is the message ID?",
						type: "string"
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return msg.member.roles.highest.comparePositionTo(msg.guild.roles.cache.get(tokens.roleIDs.moderator)) >= 0;
		}

		run(msg: CommandoMessage, args: { messageid: string }) {
			const channel = msg.guild.channels.cache.find(channel => channel.name == "mods-minor" && channel.type === "text") as TextChannel;
			return channel.messages.fetch(args.messageid).then(message => {
				if (message.embeds.length != 1) {
					return msg.reply("Invalid number of embeds on target message.");
				}

				const targetEmbed = message.embeds[0];

				const embed = new Discord.RichEmbed({
					title: targetEmbed.title,
					url: targetEmbed.url,
					description: targetEmbed.description,
					author: {
						name: targetEmbed.author.name,
						icon_url: targetEmbed.author.iconURL,
						url: targetEmbed.author.url
					},
					thumbnail: {
						url: targetEmbed.thumbnail.url
					},
					timestamp: targetEmbed.timestamp
				});
		
				embed.setColor("#0055aa");

				new Discord.WebhookClient(tokens.majorWebhook.id, tokens.majorWebhook.token).send(message.content, {
					disableEveryone: true,
					embeds: [
						embed
					],
				});

				message.delete().catch(logger.error);
			}).catch(logger.error);
		}
	},
	class AgreeCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "agree",
				aliases: ["agree", "iagree", "ia"],
				group: "administration",
				memberName: "agree",
				description: "Accepts the rules of the server.",
				examples: ["agree"],
				guildOnly: true
			});
		}

		run(msg: CommandoMessage) {
			if (msg.member.roles.cache.has("640569603344302107"))
				return;

			msg.member.roles.add("640569603344302107");

			return Promise.resolve(null);
		}
	},
	class UpdateCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "update",
				aliases: ["update", "u"],
				group: "administration",
				memberName: "update",
				description: "Updates the bot.",
				examples: ["update"],
				ownerOnly: true
			});
		}

		run(msg: CommandoMessage) {
			if (msg.guild != null)
				return;

			msg.client.provider.set("global", "updating", true);
			elevate("update.bat");
			
			return Promise.resolve(null);
		}
	},
	class LogsCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "logs",
				aliases: ["log", "l"],
				group: "administration",
				memberName: "logs",
				description: "Gets the current bot logs.",
				examples: ["logs"],
				ownerOnly: true
			});
		}

		run(msg: CommandoMessage) {
			if (msg.guild != null)
				return;

			execSync("logs.bat");
			return msg.reply({ files: [{ attachment: "logs.7z" }] })
				.then(() => require("fs").unlinkSync("logs.7z"))
				.catch(logger.error);
		}
	},
];