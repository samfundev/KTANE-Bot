import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import TaskManager from "../../task-manager";

@ApplyOptions<Command.Options>({
	name: "mute",
	aliases: ["mute", "m"],
	description: "Toggles if someone is allowed to speak in text and voice channels.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["MANAGE_ROLES"],
	requiredUserPermissions: ["MUTE_MEMBERS"],
})
export default class MuteCommand extends Command {
	usage = "<target> [duration]";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const target = await args.pick("member");
		const duration = await args.pick("duration").catch(() => null);

		if (target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			msg.reply(`${target.user.username} has a equal or higher role compared to you.`).catch(Logger.errorPrefix("Failed to send message:"));
			return;
		}

		const muted = target.roles.cache.has(tokens.roleIDs.voiceMuted);
		if (muted) {
			target.roles.remove(tokens.roleIDs.voiceMuted)
				.then(() => {
					TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.voiceMuted && task.memberID == target.id);
					return msg.reply(`${target.user.username} has been unmuted.`);
				})
				.catch(Logger.errorReply("unmute", msg));
		} else {
			target.roles.add(tokens.roleIDs.voiceMuted)
				.then(() => msg.reply(`${target.user.username} has been muted.`))
				.catch(Logger.errorReply("mute", msg));

			if (duration != null)
				TaskManager.addTask({ timestamp: Date.now() + duration, type: "removeRole", roleID: tokens.roleIDs.voiceMuted, memberID: target.id, guildID: msg.guild.id });
		}

		if (target.voice.channel) target.voice.setMute(!muted).catch(() => msg.reply("Unable to change server mute status."));
	}
}