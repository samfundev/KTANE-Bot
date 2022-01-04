import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Message } from "discord.js";
import tokens from "../../get-tokens";

@ApplyOptions<Command.Options>({
	name: "role-list",
	aliases: ["rolelist", "rl", "roles"],
	description: "Lists of all the roles that can be used with the role command.",
	runIn: "GUILD_ANY",
	cooldownDelay: 60000,
	cooldownLimit: 1,
})
export default class RoleListCommand extends Command {
	messageRun(msg: Message): Promise<Message> {
		return msg.channel.send(`Roles:\n${tokens.roleIDs.assignable.map(role => ` - ${role.aliases.join(", ")}`).join("\n")}`);
	}
}