import { Command } from "discord-akairo";
import { GuildMember } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import TaskManager from "../../task-manager";

export default class ReactionCommand extends Command {
	constructor() {
		super("reaction", {
			aliases: ["reaction", "react"],
			category: "administration",
			description: "Toggles if someone is allowed to react.",
			channel: "guild",
			clientPermissions: ["MANAGE_ROLES"],
			userPermissions: ["MUTE_MEMBERS"],

			args: [
				{
					id: "target",
					type: "member"
				},
				{
					id: "duration",
					type: "duration"
				},
			]
		});
	}

	exec(msg: GuildMessage, args: { target: GuildMember, duration: number }): void {
		if (args.target.roles.highest.comparePositionTo(msg.member.roles.highest) >= 0) {
			msg.reply(`${args.target.user.username} has a equal or higher role compared to you.`);
			return;
		}

		const noReaction = args.target.roles.cache.has(tokens.roleIDs.noReaction);
		if (noReaction) {
			TaskManager.removeTask("removeRole", task => task.info.roleID == tokens.roleIDs.noReaction && task.info.memberID == args.target.id);
			
			args.target.roles.remove(tokens.roleIDs.noReaction)
				.then(() => msg.reply(`${args.target.user.username} has been allowed to react.`))
				.catch(Logger.errorReply("remove role", msg));
		} else {
			TaskManager.addTask(Date.now(), "removeRole", { roleID: tokens.roleIDs.noReaction, memberID: args.target.id, guildID: msg.guild.id });
			
			args.target.roles.add(tokens.roleIDs.noReaction)
				.then(() => msg.reply(`${args.target.user.username} has been prevented from reacting.`))
				.catch(Logger.errorReply("add role", msg));
		}
	}
}