import { AkairoClient } from "discord-akairo";
import { TextChannel } from "discord.js";
import logger from "./log";


class TaskManager {
	static client: AkairoClient;

	static get tasks(): ScheduledTask[] {
		return this.client.settings.get("global", "scheduledTasks", []);
	}

	static set tasks(newTasks) {
		this.client.settings.set("global", "scheduledTasks", newTasks);
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

						textChannel.messages.fetch(info.messageID)
							.then(async message => {
								var reaction = message.reactions.cache.get(info.emojiKey);
								if (!reaction)
									return Promise.reject("Reaction missing.");

								return await reaction.fetch();
							})
							.then(reaction => reaction.users.remove(info.userID).catch(logger.error));
						break;
					case "unbanMember":
						var guild = this.client.guilds.cache.get(info.guildID);
						if (!guild)
							return true;

						guild.members.unban(info.memberID).catch(reason => {
							logger.error("failed to unban", info.memberID, reason);
							this.sendOwnerMessage("Failed to unban a user. Check the logs.");
						});
						break;
					case "removeRole":
						var guild = this.client.guilds.cache.get(info.guildID);
						if (!guild)
							return true;

						guild.members.fetch(info.memberID).then(member => member.roles.remove(info.roleID)).catch(reason => {
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
		if (typeof this.client.ownerID == "string")
			this.client.users.fetch(this.client.ownerID).then(user => user.send(text));
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