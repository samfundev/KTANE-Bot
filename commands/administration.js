const commando = require("discord.js-commando");
const tokens = require("./../tokens");
const logger = require("./../log");

module.exports = [
	class VoiceMuteCommand extends commando.Command {
		constructor(client) {
			super(client, {
				name: "voice-mute",
				aliases: ["voicemute", "vm"],
				group: "administration",
				memberName: "voice-mute",
				description: "Toggles if someone is allowed to speak in voice channels.",
				examples: ["voicemute <name>", "vm <user>"],
				guildOnly: true,

				args: [
					{
						key: "target",
						prompt: "Who should be muted?",
						type: "member"
					}
				]
			});
		}

		hasPermission(msg) {
			return msg.member.hasPermission("MUTE_MEMBERS");
		}

		run(msg, args) {
			if (args.target.highestRole.comparePositionTo(msg.member.highestRole) < 0) {
				let muted = args.target.roles.has(tokens.roleIDs.voiceMuted);

				if (muted)
					args.target.removeRole(tokens.roleIDs.voiceMuted)
						.then(() => msg.reply(`${args.target.user.username} has been unmuted.`))
						.catch(error => { console.log(error); msg.reply("Unable to unmute."); });
				else
					args.target.addRole(tokens.roleIDs.voiceMuted)
						.then(() => msg.reply(`${args.target.user.username} has been muted.`))
						.catch(error => { console.log(error); msg.reply("Unable to mute."); });

				if (args.target.voiceChannel) args.target.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
			} else msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
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
	}
];