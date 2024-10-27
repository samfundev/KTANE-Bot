import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "mute",
	aliases: ["mute", "m"],
	description: "Toggles if someone is allowed to speak in text and voice channels.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
	slashOptions: [
		{ name: "target", type: ApplicationCommandOptionType.User, description: "The user you want to mute." },
		{ name: "duration", type: ApplicationCommandOptionType.String, description: "The duration of the mute.", required: false }
	]
})
export default class MuteCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
		if (!msg.member) return;

		const target = await args.pick({ name: "target", type: "member" });
		const duration = await args.pick({ name: "duration", type: "duration" }).catch(() => null);

		if (target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			msg.reply(`${target.user.username} has a equal or higher role compared to you.`).catch(Logger.errorPrefix("Failed to send message:"));
			return;
		}

		const muted = target.roles.cache.has(tokens.roleIDs.voiceMuted);
		if (muted) {
			target.roles.remove(tokens.roleIDs.voiceMuted)
				.then(async () => {
					TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.voiceMuted && task.memberID == target.id);
					return msg.reply(`${target.user.username} has been unmuted.`);
				})
				.catch(Logger.errorReply("unmute", msg));
		} else {
			target.roles.add(tokens.roleIDs.voiceMuted)
				.then(async () => msg.reply(`${target.user.username} has been muted.`))
				.catch(Logger.errorReply("mute", msg));

			if (duration != null)
				TaskManager.addTask({ timestamp: Date.now() + duration, type: "removeRole", roleID: tokens.roleIDs.voiceMuted, memberID: target.id, guildID: msg.guild.id });
		}

		if (target.voice.channel) target.voice.setMute(!muted).catch(async () => msg.reply("Unable to change server mute status."));
	}
}