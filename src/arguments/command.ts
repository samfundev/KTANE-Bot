import { Argument, Command, container } from "@sapphire/framework";
import { ApplicationCommandOptionType, CommandInteractionOption } from "discord.js";

export class CommandArgument extends Argument<Command> {
	public constructor(context: Argument.LoaderContext) {
		super(context, { optionType: ApplicationCommandOptionType.String });
	}

	public run(parameter: string | CommandInteractionOption): Argument.Result<Command> {
		if (typeof parameter !== 'string') parameter = parameter.value as string;
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