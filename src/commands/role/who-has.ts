import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { getRole, shuffle } from "#utils/role";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "who-has",
	aliases: ["whohasrole", "whr", "whohas", "wh", "who", "w"],
	description: "Lists of (at most 10) users who have the specified role.",
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "role", type: ApplicationCommandOptionType.String, description: "The role to list users for." }
	],
	ephemeral: true
})
export class WhoHasRoleCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
		if (!msg.channel) return;

		const roleString = await args.pick({ name: "role", type: "string" });
		const roleInf = getRole(roleString, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf === null) {
			await msg.reply({ content: "Unknown role.", ephemeral: true });
			return;
		}

		const { role } = roleInf;
		const members = shuffle(Array.from(role.members.values())).filter((_, index) => index < 10);
		await msg.reply({ content: `Here is ${members.length} (of ${role.members.size}) users with the ${role.name} role:\n${members.map(member => ` - ${member.user.username}#${member.user.discriminator}`).join("\n")}`, ephemeral: true });
	}
}