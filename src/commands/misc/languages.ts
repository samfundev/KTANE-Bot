import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { Message } from "discord.js";
import { DB } from "../../db.js";

@ApplyOptions<Command.Options>({
	name: "languages",
	aliases: ["langs", "languages", "lang", "language"],
	description: "Set your languages.",
})
export default class LanguagesCommand extends Command {
	usage = "<language ...>";

	async messageRun(message: Message, args: Args): Promise<void> {
		const languages = await args.repeat("language");

		const storedLanguages = container.db.get<Record<string, string[]>>(DB.global, "languages", {});

		storedLanguages[message.author.id] = languages;

		container.db.set(DB.global, "languages", storedLanguages);

		await message.reply(`Your languages are now set to ${languages.join(", ")}`);
	}
}