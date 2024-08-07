import { ApplyOptions } from "@sapphire/decorators";
import { Command, Precondition } from "@sapphire/framework";
import { Message } from "discord.js";
import { isModerator } from "../bot-utils.js";

@ApplyOptions<Precondition.Options>({ position: 1 })
export default class ModeratorPrecondition extends Precondition {
	messageRun(message: Message, command: Command): Precondition.Result {
		if ((command.category == "administration" || command.name == "createvote" || command.name == "endvote") && !isModerator(message)) {
			return this.error({ message: "Only moderators can use this command." });
		}

		return this.ok();
	}
}