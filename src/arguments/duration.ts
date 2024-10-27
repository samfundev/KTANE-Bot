import { Argument } from "@sapphire/framework";
import { parseDuration } from "../duration.js";
import { ApplicationCommandOptionType, CommandInteractionOption } from "discord.js";

export class DurationArgument extends Argument<number> {
	public constructor(context: Argument.LoaderContext) {
		super(context, { optionType: ApplicationCommandOptionType.String });
	}

	public run(parameter: string | CommandInteractionOption): Argument.Result<number> {
		if (typeof parameter !== 'string') parameter = parameter.value as string;
		const duration = parseDuration(parameter);
		if (duration === null) return this.error({ parameter, message: "The provided argument could not resolved to a duration." });

		return this.ok(duration);
	}
}

declare module "@sapphire/framework" {
	interface ArgType {
		duration: number;
	}
}