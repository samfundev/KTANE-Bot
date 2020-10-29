import { Command } from "discord-akairo";
import { GuildMember } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";

export default class ToggleRoleCommand extends Command {
	constructor() {
		super("toggle-role", {
			aliases: ["togglerole", "tr"],
			category: "administration",
			description: "Toggles a role for a user.",
			channel: "guild",
			clientPermissions: ["MANAGE_ROLES"],

			args: [
				{
					id: "target",
					type: "member"
				},
				{
					id: "role",
					type: "string"
				}
			]
		});
	}

	exec(msg: GuildMessage, args: { target: GuildMember, role: string }): void {
		const targetRole = args.role.toLowerCase();
		for (const roleData of tokens.roleIDs.modAssignable) {
			if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
				const role = msg.guild.roles.cache.get(roleData.roleID);
				if (role == undefined) {
					Logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
					return;
				}

				if (args.target.roles.cache.has(roleData.roleID)) {
					args.target.roles.remove(role)
						.then(() => msg.channel.send(`Removed the "${role.name}" role from ${args.target.user.username}.`))
						.catch(Logger.errorReply("remove the role", msg));
				} else {
					args.target.roles.add(role)
						.then(() => msg.channel.send(`Gave the "${role.name}" role to ${args.target.user.username}.`))
						.catch(Logger.errorReply("give the role", msg));
				}
			}
		}

		return;
	}
}