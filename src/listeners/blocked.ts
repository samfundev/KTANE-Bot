import { ApplyOptions } from "@sapphire/decorators";
import { Command, Listener } from "@sapphire/framework";
import { Message } from "discord.js";
import Logger from "../log";

@ApplyOptions<Listener.Options>({ event: "commandBlocked" })
export default class CommandBlockedListener extends Listener {
	run(message: Message, command: Command, reason: string): void {
		Logger.info(`${message.author.username} was blocked from using ${command.name} because ${reason}.`);
	}
}