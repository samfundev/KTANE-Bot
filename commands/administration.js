const commando = require("discord.js-commando");
const tokens = require("./../tokens");

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
	}
];