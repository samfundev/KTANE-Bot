import { AkairoClient } from "discord-akairo";
import { Snowflake, TextChannel } from "discord.js";
import tokens from "./get-tokens";
import logger from "./log";

class TaskManager {
	static client: AkairoClient;

	static get tasks(): ScheduledTask[] {
		return this.client.settings.get("global", "scheduledTasks", []);
	}

	static set tasks(newTasks: ScheduledTask[]) {
		this.client.settings.set("global", "scheduledTasks", newTasks).catch(logger.errorPrefix("Failed to set tasks:"));
	}

	static modifyTasks(func: (tasks: ScheduledTask[]) => ScheduledTask[]): void {
		this.tasks = func(this.tasks);
	}

	static addTask(task: ScheduledTask): void {
		this.modifyTasks(tasks => {
			tasks.push(task);
			return tasks;
		});
	}

	static removeTask<T extends TaskTypes>(type: T, filter: (task: Extract<ScheduledTask, { type: T }>) => boolean): void;
	static removeTask(type: TaskTypes, filter: (task: ScheduledTask) => boolean): void {
		this.modifyTasks(tasks => tasks.filter(task => task.type !== type || task.timestamp > Date.now() || !filter(task)));
	}

	static processTasks(): void {
		if (tokens.debugging)
			return;

		this.modifyTasks(tasks => {
			if (tasks.length == 0)
				return tasks;

			return tasks.filter(task => {
				if (task.timestamp > Date.now())
					return true;

				switch (task.type) {
					case "removeReaction": {
						const textChannel = this.client.channels.cache.get(task.channelID) as TextChannel;

						textChannel.messages.fetch(task.messageID)
							.then(async message => {
								const reaction = message.reactions.cache.get(task.emojiKey);
								if (!reaction)
									return Promise.reject("Reaction missing.");

								return await reaction.fetch();
							})
							.then(reaction => reaction.users.remove(task.userID)).catch(logger.error);
						break;
					}
					case "unbanMember": {
						const guild = this.client.guilds.cache.get(task.guildID);
						if (!guild)
							return true;

						guild.members.unban(task.memberID).catch(reason => {
							logger.error("failed to unban", task.memberID, reason);
							this.sendOwnerMessage("Failed to unban a user. Check the logs.");
						});
						break;
					}
					case "removeRole": {
						const guild = this.client.guilds.cache.get(task.guildID);
						if (!guild)
							return true;

						guild.members.fetch(task.memberID).then(member => member.roles.remove(task.roleID)).catch(reason => {
							logger.error("failed to remove role", task.memberID, task.roleID, reason);
							this.sendOwnerMessage("Failed to remove a role. Check the logs.");
						});
						break;
					}
				}

				return false;
			});
		});
	}

	static sendOwnerMessage(text: string): void {
		if (typeof this.client.ownerID == "string")
			this.client.users.fetch(this.client.ownerID).then(user => user.send(text)).catch(logger.errorPrefix("Failed to send owner message:"));
	}
}

interface BaseTask {
	timestamp: number;
	type: string;
}

interface RemoveReactionTask extends BaseTask {
	type: "removeReaction";
	channelID: Snowflake;
	messageID: Snowflake;
	userID: Snowflake;
	emojiKey: string;
}

interface UnbanMemberTask extends BaseTask {
	type: "unbanMember";
	guildID: Snowflake;
	memberID: Snowflake;
}

interface RemoveRoleTask extends BaseTask {
	type: "removeRole";
	guildID: Snowflake;
	memberID: Snowflake;
	roleID: Snowflake;
}

type ScheduledTask = RemoveReactionTask | UnbanMemberTask | RemoveRoleTask;
type TaskTypes = ScheduledTask["type"];

export default TaskManager;