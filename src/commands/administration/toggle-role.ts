import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";
import Logger from "../../log.js";

@ApplyOptions<Command.Options>({
	name: "toggle-role",
	aliases: ["togglerole", "tr"],
	description: "Toggles a role for a user.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
})
export default class ToggleRoleCommand extends MixedCommand {
	usage = "<target> <role>";

	async run(msg: MixedInteraction, args: Args): Promise<void> {
		if (!msg.inGuild()) return;

		const target = await args.pick({ name: "target", type: "member" });
		const role = await args.pick({ name: "role", type: "string" });

		const targetRole = role.toLowerCase();
		for (const roleData of tokens.roleIDs.modAssignable) {
			if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
				const role = msg.guild.roles.cache.get(roleData.roleID);
				if (role == undefined) {
					Logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
					return;
				}

				if (target.roles.cache.has(roleData.roleID)) {
					await target.roles.remove(role);
					msg.channel.send(`Removed the "${role.name}" role from ${target.user.username}.`)
						.catch(Logger.errorReply("remove the role", msg));
				} else {
					await target.roles.add(role);
					msg.channel.send(`Gave the "${role.name}" role to ${target.user.username}.`)
						.catch(Logger.errorReply("give the role", msg));
				}
			}
		}

		return;
	}
}