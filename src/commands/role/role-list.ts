import { Command } from "discord-akairo";
import { Message } from "discord.js";
import tokens from "../../get-tokens";

export default class RoleListCommand extends Command {
	constructor() {
		super("role-list", {
			aliases: ["rolelist", "rl", "roles"],
			category: "public",
			description: "Lists of all the roles that can be used with the role command.",
			channel: "guild",
			cooldown: 60000,
			ratelimit: 1
		});
	}

	exec(msg: Message): Promise<Message> {
		return msg.channel.send(`Roles:\n${tokens.roleIDs.assignable.map(role => ` - ${role.aliases.join(", ")}`).join("\n")}`);
	}
}