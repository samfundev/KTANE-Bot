import { Argument, Command, container } from "@sapphire/framework";

export class CommandArgument extends Argument<Command> {
	public run(parameter: string): Argument.Result<Command> {
		const aliases = container.stores.get("commands").aliases;
		for (const alias of aliases.keys()) {
			if (parameter.toLowerCase() === alias) {
				const command = aliases.get(alias);
				if (command !== undefined) {
					return this.ok(command);
				}
			}
		}

		return this.error({ parameter, message: "The provided argument could not resolved to a command." });
	}
}

declare module "@sapphire/framework" {
	interface ArgType {
		command: Command;
	}
}