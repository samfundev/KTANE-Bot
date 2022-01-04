import { ApplyOptions } from "@sapphire/decorators";
import { container, Precondition } from "@sapphire/framework";
import { Message } from "discord.js";

@ApplyOptions<Precondition.Options>({ position: 1 })
export default class OwnerPrecondition extends Precondition {
	run(message: Message): Precondition.Result {
		return message.author.id === container.ownerID ? this.ok() : this.error({ message: "You cannot use this command." });
	}
}

declare module "@sapphire/framework" {
	interface Preconditions {
		OwnerOnly: never;
	}
}