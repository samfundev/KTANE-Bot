import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import {
	MixedCommand,
	MixedInteraction,
	MixedOptions,
} from "../../mixed-command.js";
import { settings } from "../../db.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "languages",
	aliases: ["langs", "languages", "lang", "language"],
	description: "Set your languages.",
	slashOptions: [
		{
			name: "languages",
			type: ApplicationCommandOptionType.String,
			description: "The languages you speak.",
		},
	],
	ephemeral: true,
})
export default class LanguagesCommand extends MixedCommand {
	async run(message: MixedInteraction, args: Args): Promise<void> {
		const languages = await args.repeat({
			name: "languages",
			type: "language",
		});

		settings.write.global.languages[message.author.id] = languages;

		await message.reply({
			content: `Your languages are now set to ${languages.join(", ")}`,
			ephemeral: true,
		});
	}
}
