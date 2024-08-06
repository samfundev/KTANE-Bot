import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";
import { DB } from "../../db.js";

@ApplyOptions<Command.Options>({
	name: "languages",
	aliases: ["langs", "languages", "lang", "language"],
	description: "Set your languages.",
})
export default class LanguagesCommand extends MixedCommand {
	usage = "<language ...>";

	async run(message: MixedInteraction, args: Args): Promise<void> {
		const languages = await args.repeat({ name: "languages", type: "language" });

		const storedLanguages = container.db.get<Record<string, string[]>>(DB.global, "languages", {});

		storedLanguages[message.author.id] = languages;

		container.db.set(DB.global, "languages", storedLanguages);

		await message.reply(`Your languages are now set to ${languages.join(", ")}`);
	}
}