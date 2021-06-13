import { Command } from "discord-akairo";
import { GuildMember } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import TaskManager from "../../task-manager";

export default class MuteCommand extends Command {
	constructor() {
		super("mute", {
			aliases: ["mute", "m"],
			category: "administration",
			description: "Toggles if someone is allowed to speak in text and voice channels.",
			channel: "guild",
			clientPermissions: ["MANAGE_ROLES"],
			userPermissions: ["MUTE_MEMBERS"],

			args: [
				{
					id: "target",
					type: "member"
				},
				{
					id: "duration",
					type: "duration"
				},
			]
		});
	}

	exec(msg: GuildMessage, args: { target: GuildMember, duration: number }): void {
		if (args.target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`).catch(Logger.errorPrefix("Failed to send message:"));
			return;
		}

		const muted = args.target.roles.cache.has(tokens.roleIDs.voiceMuted);
		if (muted) {
			args.target.roles.remove(tokens.roleIDs.voiceMuted)
				.then(() => {
					TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.voiceMuted && task.memberID == args.target.id);
					return msg.reply(`${args.target.user.username} has been unmuted.`);
				})
				.catch(Logger.errorReply("unmute", msg));
		} else {
			args.target.roles.add(tokens.roleIDs.voiceMuted)
				.then(() => msg.reply(`${args.target.user.username} has been muted.`))
				.catch(Logger.errorReply("mute", msg));

			if (args.duration != null)
				TaskManager.addTask({ timestamp: Date.now() + args.duration, type: "removeRole", roleID: tokens.roleIDs.voiceMuted, memberID: args.target.id, guildID: msg.guild.id });
		}

		if (args.target.voice.channel) args.target.voice.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
	}
}