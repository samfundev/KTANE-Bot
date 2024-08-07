import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";

@ApplyOptions<Command.Options>({
	name: "ban",
	aliases: ["b"],
	description: "Bans someone for a specified duration.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["BanMembers"],
	requiredUserPermissions: ["BanMembers"],
})
export default class BanCommand extends MixedCommand {
	usage = "<target> [duration]";

	async run(msg: MixedInteraction, args: Args): Promise<void> {
		if (!msg.inGuild()) return;

		const target = await args.pick({ name: "target", type: "member" });
		const duration = await args.pick({ name: "duration", type: "duration" }).catch(() => null);

		msg.guild.members.ban(target)
			.then(() => {
				// Remove any old tasks so we don't have multiple tasks to unban someone.
				TaskManager.removeTask("unbanMember", task => task.memberID === target.id);

				if (duration != null)
					TaskManager.addTask({ timestamp: Date.now() + duration, type: "unbanMember", guildID: msg.guild.id, memberID: target.id });
				return msg.reply("The user has been banned.");
			})
			.catch(Logger.errorReply("ban the user", msg));
	}
}