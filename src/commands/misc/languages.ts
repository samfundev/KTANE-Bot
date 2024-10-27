import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { DB } from "../../db.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "languages",
	aliases: ["langs", "languages", "lang", "language"],
	description: "Set your languages.",
	slashOptions: [
		{ name: "languages", type: ApplicationCommandOptionType.String, description: "The languages you speak." }
	],
	ephemeral: true
})
export default class LanguagesCommand extends MixedCommand {
	async run(message: MixedInteraction, args: Args): Promise<void> {
		const languages = await args.repeat({ name: "languages", type: "language" });

		const storedLanguages = container.db.get<Record<string, string[]>>(DB.global, "languages", {});

		storedLanguages[message.author.id] = languages;

		container.db.set(DB.global, "languages", storedLanguages);

		await message.reply({ content: `Your languages are now set to ${languages.join(", ")}`, ephemeral: true });
	}
}