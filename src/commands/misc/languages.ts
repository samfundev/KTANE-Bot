import { Command, FailureData } from "discord-akairo";
import { Message, Util } from "discord.js";

export default class LanguagesCommand extends Command {
	constructor() {
		super("languages", {
			category: "misc",
			aliases: ["langs", "languages", "lang", "language"],
			args: [
				{
					id: "languages",
					type: "language",
					match: "separate",
					otherwise: (message: Message, data: FailureData) => `"${Util.cleanContent(data.phrase, message)}" is an invalid language.`
				}
			]
		});
	}

	async exec(message: Message, { languages }: { languages: (string | null)[] }): Promise<void> {
		const storedLanguages = this.client.settings.get("global", "languages", {});

		storedLanguages[message.author.id] = languages;

		this.client.settings.set("global", "languages", storedLanguages);

		message.reply(`Your languages are now set to ${languages.join(", ")}`);
	}
}