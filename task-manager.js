const logger = require("./log");

class TaskManager {
	static client;

	static get tasks() {
		return this.client.provider.get("global", "scheduledTasks", []);
	}

	static set tasks(newTasks) {
		this.client.provider.set("global", "scheduledTasks", newTasks);
	}

	static modifyTasks(func) {
		this.tasks = func(this.tasks);
	}

	static addTask(timestamp, type, info) {
		this.modifyTasks(tasks => {
			tasks.push(new ScheduledTask(timestamp, type, info));
			return tasks;
		});
	}

	static removeTask(type, filter) {
		this.modifyTasks(tasks => tasks.filter(task => task.type != type || task.timestamp > Date.new() || !filter(task)));
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
						this.client.channels.get(info.channelID).fetchMessage(info.messageID).then(message => {
							message.reactions.get(info.emojiKey).remove(info.userID).catch(logger.error);
						});
						break;
					case "unbanMember":
						this.client.guilds.get(info.guildID).unban(info.memberID).catch(reason => {
							logger.error("failed to unban", info.memberID, reason);
							this.client.fetchUser(this.client.options.owner).then(user => user.send("Failed to unban a user. Check the logs."));
						});
						break;
					case "removeRole":
						this.client.guilds.get(info.guildID).fetchMember(info.memberID).removeRole(info.roleID).catch(reason => {
							logger.error("failed to remove role", info.memberID, info.roleID, reason);
							this.client.fetchUser(this.client.options.owner).then(user => user.send("Failed to remove a role. Check the logs."));
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
}

class ScheduledTask {
	constructor(timestamp, type, info) {
		this.timestamp = timestamp;
		this.type = type;
		this.info = info;
	}
}

module.exports = TaskManager;