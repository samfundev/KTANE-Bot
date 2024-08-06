import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";
import { formatDuration } from "../../duration.js";
import TaskManager from "../../task-manager.js";

@ApplyOptions<Command.Options>({
	name: "tasks",
	aliases: ["t"],
	description: "Tells you all the tasks scheduled for a user.",
	runIn: "GUILD_ANY",
})
export default class TasksCommand extends MixedCommand {
	usage = "<target>";

	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const target = await args.pick({ name: "target", type: "member" });

		const tasks = TaskManager.tasks.filter(task => task.type !== "removeReaction" && task.memberID === target.id);
		if (tasks.length === 0) {
			await msg.reply("No tasks for that user.");
			return;
		}

		await msg.reply(`Tasks:\n${tasks.map(task => `${task.type} - ${formatDuration(task.timestamp - Date.now() / 1000)}`).join("\n")}`);
	}
}