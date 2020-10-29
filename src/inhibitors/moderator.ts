import { Command, Inhibitor } from "discord-akairo";
import { Message } from "discord.js";
import { isModerator } from "../bot-utils";

export default class ModeratorInhibitor extends Inhibitor {
	constructor() {
		super("moderator", {
			reason: "they're not a moderator"
		});
	}

	exec(message: Message, command: Command): boolean {
		return (command.categoryID == "administration" || command.id == "createvote" || command.id == "endvote") && !isModerator(message);
	}
}