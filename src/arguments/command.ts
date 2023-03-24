import { Argument, Command, container } from "@sapphire/framework";

export class CommandArgument extends Argument<Command> {
	public run(parameter: string): Argument.Result<Command> {
		const command = container.stores.get("commands").get(parameter.toLowerCase());
		if (command !== undefined) {
			return this.ok(command);
		}

		return this.error({ parameter, message: "The provided argument could not resolved to a command." });
	}
}

declare module "@sapphire/framework" {
	interface ArgType {
		command: Command;
	}
}