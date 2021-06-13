import { Command } from "discord-akairo";
import { Message } from "discord.js";
import Logger from "../../log";
import lintMessage from "../../repolint";

export default class LintCommand extends Command {
	constructor() {
		super("lint", {
			aliases: ["lint", "li", "scan", "s"],
			category: "misc",
			description: "Lints a message using RepoLint.",
			channel: "dm"
		});
	}

	exec(msg: Message): void {
		lintMessage(msg, this.client).catch(Logger.errorPrefix("Failed to lint message:"));
	}
}