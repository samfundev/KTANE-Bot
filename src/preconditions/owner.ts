import { ApplyOptions } from "@sapphire/decorators";
import { container, Precondition, PreconditionOptions } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message } from "discord.js";

@ApplyOptions<PreconditionOptions>({ name: "OwnerOnly" })
export default class OwnerOnlyPrecondition extends Precondition {
	messageRun(message: Message): Precondition.Result {
		return message.author.id === container.ownerID ? this.ok() : this.error({ message: "You cannot use this command." });
	}

	chatInputRun(interaction: ChatInputCommandInteraction): Precondition.Result {
		return interaction.user.id === container.ownerID ? this.ok() : this.error({ message: "You cannot use this command." });
	}
}

declare module "@sapphire/framework" {
	interface Preconditions {
		OwnerOnly: never;
	}
}