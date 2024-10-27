import { ApplyOptions } from "@sapphire/decorators";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import tokens from "../../get-tokens.js";

@ApplyOptions<MixedOptions>({
	name: "role-list",
	aliases: ["rolelist", "rl", "roles"],
	description: "Lists of all the roles that can be used with the role command.",
	runIn: "GUILD_ANY",
	cooldownDelay: 60000,
	cooldownLimit: 1,
	slashOptions: [],
	ephemeral: true
})
export default class RoleListCommand extends MixedCommand {
	async run(msg: MixedInteraction<true>): Promise<void> {
		await msg.reply({
			content: `Roles:\n${tokens.roleIDs.assignable.map(role => ` - ${role.aliases.join(", ")}`).join("\n")}`,
			ephemeral: true
		});
	}
}