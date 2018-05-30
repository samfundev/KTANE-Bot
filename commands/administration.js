const commando = require("discord.js-commando");

const voiceMutedRoleID = "426080215123623936";

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
			return msg.member.hasPermission("MUTE_MEMBERS") && (msg.channel.name == "moderators-only" || msg.channel.name == "admins-only" || msg.channel.name == "bot-commands");
		}

		run(msg, args) {
			if (args.target.highestRole.comparePositionTo(msg.member.highestRole) < 0) {
				let muted = args.target.roles.has(voiceMutedRoleID);
				
				if (muted) args.target.removeRole(voiceMutedRoleID).then(() => msg.reply(`${args.target.user.username} has been unmuted.`)).catch(() => msg.reply("Unable to unmute."));
				else args.target.addRole(voiceMutedRoleID).then(() => msg.reply(`${args.target.user.username} has been muted.`)).catch(() => msg.reply("Unable to mute."));

				if (args.target.voiceChannel) args.target.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
			} else msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
		}
	}
];