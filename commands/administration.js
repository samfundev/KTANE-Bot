const Discord = require("discord.js");
const commando = require("discord.js-commando");
const tokens = require("./../tokens");
const logger = require("./../log");
const TaskManager = require("./../task-manager");
const sqlite = require("sqlite");
const { execSync } = require("child_process");
const { elevate } = require("node-windows");

// All of these are in minutes.
const durations = {
	h: 60,
	d: 1440,
	w: 10080,
	m: 43830,
}

function parseDuration(string) {
	const matches = /(\d+(?:\.\d+)?)([a-z])/.exec(string);
	if (matches == null || !durations.hasOwnProperty(matches[2]))
		return null;

	return 1000 * 60 * durations[matches[2]] * parseFloat(matches[1]);
}

module.exports = [
	class MuteCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.hasPermission("MUTE_MEMBERS");
		}

		run(msg, args) {
			if (args.target.highestRole.comparePositionTo(msg.member.highestRole) < 0) {
				let muted = args.target.roles.has(tokens.roleIDs.voiceMuted);

				const duration = parseDuration(args.duration);
				if (args.duration != "" && duration == null) {
					msg.reply("That's an invalid duration.");
					return;
				}

				if (muted) {
					args.target.removeRole(tokens.roleIDs.voiceMuted)
						.then(() => msg.reply(`${args.target.user.username} has been unmuted.`))
						.catch(error => { console.log(error); msg.reply("Unable to unmute."); });
					
					TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.voiceMuted && task.memberID == args.target.id)
				} else {
					args.target.addRole(tokens.roleIDs.voiceMuted)
						.then(() => msg.reply(`${args.target.user.username} has been muted.`))
						.catch(error => { console.log(error); msg.reply("Unable to mute."); });
					
					TaskManager.addTask(Date.now(), "removeRole", { roleID: tokens.roleIDs.voiceMuted, memberID: args.target.id, guildID: msg.guild.id });
				}

				if (args.target.voiceChannel) args.target.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
			} else msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
		}
	},
	class ReactionCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.hasPermission("MUTE_MEMBERS");
		}

		run(msg, args) {
			if (args.target.highestRole.comparePositionTo(msg.member.highestRole) < 0) {
				let noReaction = args.target.roles.has(tokens.roleIDs.noReaction);

				const duration = parseDuration(args.duration);
				if (args.duration != "" && duration == null) {
					msg.reply("That's an invalid duration.");
					return;
				}

				if (noReaction) {
					args.target.removeRole(tokens.roleIDs.noReaction)
						.then(() => msg.reply(`${args.target.user.username} has been allowed to react.`))
						.catch(error => { console.log(error); msg.reply("Unable to remove role."); });
					
					TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.noReaction && task.memberID == args.target.id)
				} else {
					args.target.addRole(tokens.roleIDs.noReaction)
						.then(() => msg.reply(`${args.target.user.username} has been prevented from reacting.`))
						.catch(error => { console.log(error); msg.reply("Unable to add role."); });
					
					TaskManager.addTask(Date.now(), "removeRole", { roleID: tokens.roleIDs.noReaction, memberID: args.target.id, guildID: msg.guild.id });
				}
			} else msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
		}
	},
	class BanCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.hasPermission("BAN_MEMBERS");
		}

		run(msg, args) {
			const duration = parseDuration(args.duration);
			if (duration == null) {
				msg.reply("That's an invalid duration.");
				return;
			}

			args.target.ban()
				.then(() => {
					msg.reply("The user has been banned.");
					TaskManager.addTask(Date.now() + duration, "unbanMember", { guildID: msg.guild.id, memberID: args.target.id });
				})
				.catch(logger.error);
		}
	},
	class ToggleRoleCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.highestRole.comparePositionTo(msg.guild.roles.get(tokens.roleIDs.moderator)) >= 0;
		}

		run(msg, args) {
			const targetRole = args.role.toLowerCase();
			for (let roleData of tokens.roleIDs.modAssignable) {
				if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
					const role = msg.guild.roles.get(roleData.roleID);
					if (role == undefined) {
						logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
						return;
					}

					if (args.target.roles.has(roleData.roleID)) {
						args.target.removeRole(role)
							.then(() => msg.channel.send(`Removed the "${role.name}" role from ${args.target.user.username}.`))
							.catch(logger.error);
					} else {
						args.target.addRole(role)
							.then(() => msg.channel.send(`Gave the "${role.name}" role to ${args.target.user.username}.`))
							.catch(logger.error);
					}

					break;
				}
			}
		}
	},
	class SetSteamIDCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.highestRole.comparePositionTo(msg.guild.roles.get(tokens.roleIDs.moderator)) >= 0;
		}

		run(msg, args) {
			sqlite.open("database.sqlite3", { cached: true })
				.then(db =>
					db.run("INSERT INTO 'author_lookup' (steam_id, discord_id) VALUES(?, ?) ON CONFLICT(steam_id) DO UPDATE SET discord_id=excluded.discord_id", args.steamid, args.discordid)
						.then(() => msg.reply(`Set "${args.steamid}" to "${args.discordid}".`))
						.catch(error => { msg.reply("Failed to set."); logger.error(error); })
				);
		}
	},
	class RefreshRoleMenuCommand extends commando.Command {
		constructor(client) {
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

		run(msg) {
			for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus))
			{
				const [channelID, msgID] = menuMessageID.split('/');
				let channel = null;
				for (let [id, ch] of msg.guild.channels)
					if (id === channelID)
						channel = ch;
				if (!channel)
				{
					logger.error(`Cannot find channel ${channelID}. Channels are:`);
					for (let [key, value] of msg.guild.channels)
						logger.error(` -- ${key} = ${value}`)
					continue;
				}
				channel.fetchMessage(msgID)
					.then(async(message) => {
						for (const emojiName in emojis)
							await message.react(emojiName);
					})
					.catch(logger.error);
			}
			msg.delete().catch(logger.error);
		}
	},
	class MakeMajorCommand extends commando.Command {
		constructor(client) {
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

		hasPermission(msg) {
			return msg.member.highestRole.comparePositionTo(msg.guild.roles.get(tokens.roleIDs.moderator)) >= 0;
		}

		run(msg, args) {
			msg.guild.channels.find(channel => channel.name == "mods-minor").fetchMessage(args.messageid).then(message => {
				if (message.embeds.length != 1) {
					msg.reply("Invalid number of embeds on target message.");
					return;
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
	class AgreeCommand extends commando.Command {
		constructor(client) {
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

		run(msg) {
			if (msg.member.roles.has("640569603344302107"))
				return;

			msg.member.addRole("640569603344302107");
		}
	},
	class UpdateCommand extends commando.Command {
		constructor(client) {
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

		run(msg) {
			if (msg.guild != null)
				return;

			msg.client.provider.set("global", "updating", true);
			elevate("update.bat");
		}
	},
	class LogsCommand extends commando.Command {
		constructor(client) {
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

		run(msg) {
			if (msg.guild != null)
				return;

			execSync("logs.bat");
			msg.reply({ files: [{ attachment: "logs.7z" }] })
				.then(() => require("fs").unlinkSync("logs.7z"))
				.catch(logger.error);
		}
	},
];