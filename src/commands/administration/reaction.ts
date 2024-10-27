import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "reaction",
	aliases: ["react"],
	description: "Toggles if someone is allowed to react.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
	slashOptions: [
		{ name: "target", type: ApplicationCommandOptionType.User, description: "The user you want to toggle reacting for." },
		{ name: "duration", type: ApplicationCommandOptionType.String, description: "The duration of the reaction restriction.", required: false }
	]
})
export default class ReactionCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
		if (!msg.member) return;

		const target = await args.pick({ name: "target", type: "member" });
		const duration = await args.pick({ name: "duration", type: "duration" }).catch(() => null);

		if (target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			await msg.reply(`${target.user.username} has a equal or higher role compared to you.`);
			return;
		}

		const noReaction = target.roles.cache.has(tokens.roleIDs.noReaction);
		if (noReaction) {
			TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.noReaction && task.memberID == target.id);

			target.roles.remove(tokens.roleIDs.noReaction)
				.then(async () => msg.reply(`${target.user.username} has been allowed to react.`))
				.catch(Logger.errorReply("remove role", msg));
		} else {
			if (duration != null)
				TaskManager.addTask({ timestamp: Date.now() + duration, type: "removeRole", roleID: tokens.roleIDs.noReaction, memberID: target.id, guildID: msg.guild.id });

			target.roles.add(tokens.roleIDs.noReaction)
				.then(async () => msg.reply(`${target.user.username} has been prevented from reacting.`))
				.catch(Logger.errorReply("add role", msg));
		}
	}
}