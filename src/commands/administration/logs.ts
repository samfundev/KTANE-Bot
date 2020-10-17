import { execSync } from "child_process";
import { Command } from "discord-akairo";
import { Message } from "discord.js";
import { unlinkSync } from "fs";
import Logger from "../../log";

export default class LogsCommand extends Command {
	constructor() {
		super("logs", {
			aliases: ["log", "l"],
			category: "administration",
			description: "Gets the current bot logs.",
			ownerOnly: true
		});
	}

	exec(msg: Message): void {
		if (msg.guild != null)
			return;

		execSync("logs.bat");
		msg.reply({ files: [{ attachment: "logs.7z" }] })
			.then(() => unlinkSync("logs.7z"))
			.catch(Logger.error);
	}
}