import { Argument } from "@sapphire/framework";
import { parseLanguage } from "../language.js";

export class LanguageArgument extends Argument<string> {
	public run(parameter: string): Argument.Result<string> {
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