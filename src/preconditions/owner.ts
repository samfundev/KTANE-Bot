import { container, Precondition } from "@sapphire/framework";
import { Message } from "discord.js";

export default class OwnerPrecondition extends Precondition {
	messageRun(message: Message): Precondition.Result {
		return message.author.id === container.ownerID ? this.ok() : this.error({ message: "You cannot use this command." });
	}
}

declare module "@sapphire/framework" {
	interface Preconditions {
		OwnerOnly: never;
	}
}