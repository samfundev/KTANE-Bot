import { Command } from "discord-akairo";
import { Message } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import { getRole, RoleArgument, shuffle } from "./shared";

export class WhoHasRoleCommand extends Command {
	constructor() {
		super("who-has", {
			aliases: ["whohasrole", "whr", "whohas", "wh", "who", "w"],
			category: "public",
			description: "Lists of (at most 10) users who have the specified role.",
			channel: "guild",

			args: [
				{
					id: "role",
					type: "string"
				}
			]
		});
	}

	exec(msg: GuildMessage, args: RoleArgument): Promise<Message> | void {
		const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf === null)
			return msg.reply("Unknown role.");
	
		const { role } = roleInf;
		const members = shuffle(Array.from(role.members.values())).filter((_, index) => index < 10);
		return msg.channel.send(`Here is ${members.length} (of ${role.members.size}) users with the ${role.name} role:\n${members.map(member => ` - ${member.user.username}#${member.user.discriminator}`).join("\n")}`);
	}
}