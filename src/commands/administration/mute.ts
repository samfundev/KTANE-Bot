import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";

@ApplyOptions<Command.Options>({
	name: "mute",
	aliases: ["mute", "m"],
	description: "Toggles if someone is allowed to speak in text and voice channels.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
})
export default class MuteCommand extends Command {
	usage = "<target> [duration]";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const target = await args.pick({ name: "target", type: "member" });
		const duration = await args.pick({ name: "duration", type: "duration" }).catch(() => null);

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