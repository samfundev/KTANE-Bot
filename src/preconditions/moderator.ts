import { ApplyOptions } from "@sapphire/decorators";
import { ChatInputCommand, Command, Precondition } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message } from "discord.js";
import { isModerator } from "../bot-utils.js";

@ApplyOptions<Precondition.Options>({ position: 1 })
export default class ModeratorPrecondition extends Precondition {
	run(message: Message | ChatInputCommandInteraction<"cached">, command: Command): Precondition.Result {
		if ((command.category == "administration" || command.name == "createvote" || command.name == "endvote") && !isModerator(message)) {
			return this.error({ message: "Only moderators can use this command." });
		}

		return this.ok();
	}

	messageRun(messsage: Message, command: Command): Precondition.Result {
		return this.run(messsage, command);
	}

	chatInputRun(interaction: ChatInputCommandInteraction<"cached">, command: ChatInputCommand): Precondition.Result {
		return this.run(interaction, command);
	}
}