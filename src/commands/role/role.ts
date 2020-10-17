import { Command } from "discord-akairo";
import { Message } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import { getRole, RoleArgument } from "./shared";

export default class RoleCommand extends Command {
	constructor() {
		super("role", {
			aliases: ["role", "r"],
			category: "public",
			description: "Toggles specific roles for your user.",
			channel: "guild",

			args: [
				{
					id: "role",
					type: "string"
				}
			]
		});
	}

	exec(msg: GuildMessage, args: RoleArgument): Promise<Message | null> {
		const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf !== null) {
			const { role, roleData } = roleInf;
			if (roleData.prereq && !roleData.prereq.some(pre => msg.member.roles.cache.has(pre))) {
				return msg.channel.send(`You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`);
			}
			if (msg.member.roles.cache.has(role.id)) {
				return msg.member.roles.remove(role)
					.then(() => msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`))
					.catch(Logger.errorReply("remove role", msg));
			} else {
				return msg.member.roles.add(role)
					.then(() => msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`))
					.catch(Logger.errorReply("give role", msg));
			}
		}

		return msg.reply("Unknown role.");
	}
}