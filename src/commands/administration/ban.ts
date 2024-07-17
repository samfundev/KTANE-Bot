import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import TaskManager from "../../task-manager";

@ApplyOptions<Command.Options>({
	name: "ban",
	aliases: ["b"],
	description: "Bans someone for a specified duration.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["BanMembers"],
	requiredUserPermissions: ["BanMembers"],
})
export default class BanCommand extends Command {
	usage = "<target> [duration]";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const target = await args.pick("member");
		const duration = await args.pick("duration").catch(() => null);

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