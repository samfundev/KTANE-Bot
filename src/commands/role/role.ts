import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { Message } from "discord.js";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import Logger from "../../log.js";
import { getRole } from "#utils/role";

@ApplyOptions<Command.Options>({
	name: "role",
	aliases: ["r"],
	description: "Toggles specific roles for your user.",
	runIn: "GUILD_ANY",
})
export default class RoleCommand extends Command {
	usage = "<role>";

	async messageRun(msg: GuildMessage, args: Args): Promise<Message | null> {
		const role = await args.pick("string");

		const roleInf = getRole(role, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf !== null) {
			const { role, roleData } = roleInf;
			if (roleData.prereq && !roleData.prereq.some(pre => msg.member.roles.cache.has(pre))) {
				return msg.channel.send(`You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`);
			}
			if (msg.member.roles.cache.has(role.id)) {
				await msg.member.roles.remove(role);
				return msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`)
					.catch(Logger.errorReply("remove role", msg));
			} else {
				await msg.member.roles.add(role);
				return msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`)
					.catch(Logger.errorReply("give role", msg));
			}
		}

		return msg.reply("Unknown role.");
	}
}