import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Message } from "discord.js";
import Logger from "../../log.js";
import lintMessage from "../../repository/repolint.js";

@ApplyOptions<Command.Options>({
	name: "lint",
	aliases: ["li", "scan", "s"],
	description: "Lints a message using RepoLint.",
	runIn: "DM",
})
export default class LintCommand extends Command {
	messageRun(msg: Message): void {
		lintMessage(msg).catch(Logger.errorPrefix("Failed to lint message:"));
	}
}