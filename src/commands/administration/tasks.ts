import { Command } from "discord-akairo";
import { Message, User } from "discord.js";
import { formatDuration } from "../../duration";
import TaskManager from "../../task-manager";

export default class TasksCommand extends Command {
	constructor() {
		super("tasks", {
			aliases: ["tasks", "t"],
			category: "administration",
			description: "Tells you all the tasks scheduled for a user.",
			channel: "guild",

			args: [
				{
					id: "target",
					type: "user"
				}
			]
		});
	}

	exec(msg: Message, args: { target: User }): Promise<Message> {
		const tasks = TaskManager.tasks.filter(task => task.type !== "removeReaction" && task.memberID === args.target.id);
		if (tasks.length === 0)
			return msg.reply("No tasks for that user.");

		return msg.reply(`Tasks:\n${tasks.map(task => `${task.type} - ${formatDuration(task.timestamp - Date.now() / 1000)}`).join("\n")}`);
	}
}