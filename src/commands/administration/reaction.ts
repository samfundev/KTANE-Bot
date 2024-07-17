import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";

@ApplyOptions<Command.Options>({
	name: "reaction",
	aliases: ["react"],
	description: "Toggles if someone is allowed to react.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
})
export default class ReactionCommand extends Command {
	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const target = await args.pick("member");
		const duration = await args.pick("duration").catch(() => null);

		if (target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			await msg.reply(`${target.user.username} has a equal or higher role compared to you.`);
			return;
		}

		const noReaction = target.roles.cache.has(tokens.roleIDs.noReaction);
		if (noReaction) {
			TaskManager.removeTask("removeRole", task => task.roleID == tokens.roleIDs.noReaction && task.memberID == target.id);

			target.roles.remove(tokens.roleIDs.noReaction)
				.then(() => msg.reply(`${target.user.username} has been allowed to react.`))
				.catch(Logger.errorReply("remove role", msg));
		} else {
			if (duration != null)
				TaskManager.addTask({ timestamp: Date.now() + duration, type: "removeRole", roleID: tokens.roleIDs.noReaction, memberID: target.id, guildID: msg.guild.id });

			target.roles.add(tokens.roleIDs.noReaction)
				.then(() => msg.reply(`${target.user.username} has been prevented from reacting.`))
				.catch(Logger.errorReply("add role", msg));
		}
	}
}