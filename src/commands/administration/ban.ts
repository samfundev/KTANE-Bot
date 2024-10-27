import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";
import TaskManager from "../../task-manager.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "ban",
	aliases: ["b"],
	description: "Bans someone for a specified duration.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["BanMembers"],
	requiredUserPermissions: ["BanMembers"],
	slashOptions: [
		{ name: "target", type: ApplicationCommandOptionType.User, description: "The user you want to ban." },
		{ name: "duration", type: ApplicationCommandOptionType.String, description: "The duration of the ban.", required: false }
	]
})
export default class BanCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
		const target = await args.pick({ name: "target", type: "member" });
		const duration = await args.pick({ name: "duration", type: "duration" }).catch(() => null);

		msg.guild.members.ban(target)
			.then(async () => {
				// Remove any old tasks so we don't have multiple tasks to unban someone.
				TaskManager.removeTask("unbanMember", task => task.memberID === target.id);

				if (duration != null)
					TaskManager.addTask({ timestamp: Date.now() + duration, type: "unbanMember", guildID: msg.guild.id, memberID: target.id });
				return msg.reply("The user has been banned.");
			})
			.catch(Logger.errorReply("ban the user", msg));
	}
}