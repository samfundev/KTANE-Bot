import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";
import { getRole } from "#utils/role";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "role",
	aliases: ["r"],
	description: "Toggles specific roles for your user.",
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "role", type: ApplicationCommandOptionType.String, description: "The role to toggle." }
	],
	ephemeral: true
})
export default class RoleCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
		if (!msg.channel || !msg.member) return;

		const role = await args.pick({ name: "role", type: "string" });

		const roleInf = getRole(role, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf !== null) {
			const { role, roleData } = roleInf;
			if (roleData.prereq && !roleData.prereq.some(pre => msg.member!.roles.cache.has(pre))) {
				await msg.reply({ content: `You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`, ephemeral: true });
				return;
			}
			if (msg.member.roles.cache.has(role.id)) {
				await msg.member.roles.remove(role);
				await msg.reply({ content: `Removed the "${role.name}" role from you.`, ephemeral: true })
					.catch(Logger.errorReply("remove role", msg));
				return;
			} else {
				await msg.member.roles.add(role);
				await msg.reply({ content: `Gave you the "${role.name}" role.`, ephemeral: true })
					.catch(Logger.errorReply("give role", msg));
				return;
			}
		}

		await msg.reply("Unknown role.");
	}
}