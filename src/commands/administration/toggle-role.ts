import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";

@ApplyOptions<Command.Options>({
	name: "toggle-role",
	aliases: ["togglerole", "tr"],
	description: "Toggles a role for a user.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["MANAGE_ROLES"],
})
export default class ToggleRoleCommand extends Command {
	usage = "<target> <role>";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const target = await args.pick("member");
		const role = await args.pick("string");

		const targetRole = role.toLowerCase();
		for (const roleData of tokens.roleIDs.modAssignable) {
			if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
				const role = msg.guild.roles.cache.get(roleData.roleID);
				if (role == undefined) {
					Logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
					return;
				}

				if (target.roles.cache.has(roleData.roleID)) {
					target.roles.remove(role)
						.then(() => msg.channel.send(`Removed the "${role.name}" role from ${target.user.username}.`))
						.catch(Logger.errorReply("remove the role", msg));
				} else {
					target.roles.add(role)
						.then(() => msg.channel.send(`Gave the "${role.name}" role to ${target.user.username}.`))
						.catch(Logger.errorReply("give the role", msg));
				}
			}
		}

		return;
	}
}