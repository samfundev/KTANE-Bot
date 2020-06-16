import { CommandoClient } from "discord.js-commando";
import { TextChannel } from 'discord.js';

const logger = require("./log");

class TaskManager {
	static client: CommandoClient;

	static get tasks() {
		return this.client.provider.get("global", "scheduledTasks", []);
	}

	static set tasks(newTasks) {
		this.client.provider.set("global", "scheduledTasks", newTasks);
	}

	static modifyTasks(func: (tasks: ScheduledTask[]) => ScheduledTask[]) {
		this.tasks = func(this.tasks);
	}

	static addTask(timestamp: number, type: string, info: any) {
		this.modifyTasks(tasks => {
			tasks.push(new ScheduledTask(timestamp, type, info));
			return tasks;
		});
	}

	static removeTask(type: string, filter: (task: ScheduledTask) => boolean) {
		this.modifyTasks(tasks => tasks.filter(task => task.type != type || task.timestamp > Date.now() || !filter(task)));
	}

	static processTasks() {
		this.modifyTasks(tasks => {
			if (tasks.length == 0)
				return tasks;
	
			return tasks.filter(task => {
				if (task.timestamp > Date.now())
					return true;
	
				const info = task.info;
	
				switch (task.type) {
					case "removeReaction":
						const textChannel = this.client.channels.cache.get(info.channelID) as TextChannel;

						textChannel.messages.fetch(info.messageID).then(message => {
							message.reactions.cache.get(info.emojiKey).users.remove(info.userID).catch(logger.error);
						});
						break;
					case "unbanMember":
						this.client.guilds.cache.get(info.guildID).members.unban(info.memberID).catch(reason => {
							logger.error("failed to unban", info.memberID, reason);
							this.sendOwnerMessage("Failed to unban a user. Check the logs.");
						});
						break;
					case "removeRole":
						this.client.guilds.cache.get(info.guildID).members.fetch(info.memberID).then(member => member.roles.remove(info.roleID)).catch(reason => {
							logger.error("failed to remove role", info.memberID, info.roleID, reason);
							this.sendOwnerMessage("Failed to remove a role. Check the logs.");
						});
						break;
					default:
						logger.error("Unknown task type: " + task.type);
						break;
				}
	
				return false;
			});
		});
	}

	static sendOwnerMessage(text: string) {
		if (typeof this.client.options.owner == "string")
			this.client.users.fetch(this.client.options.owner).then(user => user.send(text));
	}
}

class ScheduledTask {
	timestamp: number;
	type: string;
	info: any;
	
	constructor(timestamp: number, type: string, info: any) {
		this.timestamp = timestamp;
		this.type = type;
		this.info = info;
	}
}

export default TaskManager;