import { Argument } from "@sapphire/framework";
import { parseLanguage } from "../language.js";
import { ApplicationCommandOptionType, CommandInteractionOption } from "discord.js";

export class LanguageArgument extends Argument<string> {
	public constructor(context: Argument.LoaderContext) {
		super(context, { optionType: ApplicationCommandOptionType.String });
	}

	public run(parameter: string | CommandInteractionOption): Argument.Result<string> {
		if (typeof parameter !== 'string') parameter = parameter.value as string;
		const language = parseLanguage(parameter);
		if (language === null) return this.error({ parameter, message: "Invalid language." });

		return this.ok(language);
	}
}

declare module "@sapphire/framework" {
	interface ArgType {
		language: string;
	}
}