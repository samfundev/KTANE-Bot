import { Command } from "discord-akairo";
import { User } from "discord.js";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import TaskManager from "../../task-manager";

export default class BanCommand extends Command {
	constructor() {
		super("ban", {
			aliases: ["ban", "b"],
			category: "administration",
			description: "Bans someone for a specified duration.",
			channel: "guild",
			clientPermissions: ["BAN_MEMBERS"],
			userPermissions: ["BAN_MEMBERS"],

			args: [
				{
					id: "target",
					type: "user"
				},
				{
					id: "duration",
					type: "duration"
				}
			]
		});
	}

	exec(msg: GuildMessage, { target, duration }: { target: User, duration: number }): void {
		msg.guild.members.ban(target)
			.then(() => {
				// Remove any old tasks so we don't have multiple tasks to unban someone.
				TaskManager.removeTask("unbanMember", task => task.info.memberID === target.id);

				TaskManager.addTask(Date.now() + duration, "unbanMember", { guildID: msg.guild.id, memberID: target.id });
				return msg.reply("The user has been banned.");
			})
			.catch(Logger.errorReply("ban the user", msg));
	}
}