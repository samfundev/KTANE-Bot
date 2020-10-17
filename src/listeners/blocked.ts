import { Command, Listener } from "discord-akairo";
import { Message } from "discord.js";
import Logger from "../log";

export default class CommandBlockedListener extends Listener {
	constructor() {
		super("commandBlocked", {
			emitter: "commandHandler",
			event: "commandBlocked"
		});
	}

	exec(message: Message, command: Command, reason: string): void {
		Logger.info(`${message.author.username} was blocked from using ${command.id} because ${reason}.`);
	}
}