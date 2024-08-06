import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";
import Logger from "../../log.js";
import { getRole } from "#utils/role";

@ApplyOptions<Command.Options>({
	name: "role",
	aliases: ["r"],
	description: "Toggles specific roles for your user.",
	runIn: "GUILD_ANY",
})
export default class RoleCommand extends MixedCommand {
	usage = "<role>";

	async run(msg: MixedInteraction, args: Args): Promise<void> {
		if (!msg.inGuild() || !msg.member) return;

		const role = await args.pick({ name: "role", type: "string" });

		const roleInf = getRole(role, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf !== null) {
			const { role, roleData } = roleInf;
			if (roleData.prereq && !roleData.prereq.some(pre => msg.member!.roles.cache.has(pre))) {
				await msg.channel.send(`You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`);
				return;
			}
			if (msg.member.roles.cache.has(role.id)) {
				await msg.member.roles.remove(role);
				await msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`)
					.catch(Logger.errorReply("remove role", msg));
				return;
			} else {
				await msg.member.roles.add(role);
				await msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`)
					.catch(Logger.errorReply("give role", msg));
				return;
			}
		}

		await msg.reply("Unknown role.");
	}
}