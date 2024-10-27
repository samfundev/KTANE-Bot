import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";

@ApplyOptions<MixedOptions>({
	name: "help",
	aliases: ["h"],
	description: "Gives info about how a command works.",
	slashOptions: [
		{ name: "command", type: ApplicationCommandOptionType.String, description: "The command you want help with." }
	],
	ephemeral: true
})
export default class HelpCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const command = await args.peek({ name: "command", type: "command" });
		await msg.reply({
			embeds: [new EmbedBuilder({
				title: `${command.name} ${usage(command as MixedCommand) ?? ""}`,
				description: `${command.description}\n\n**Aliases:** ${command.aliases.join(", ")}`,
			}).setColor([52, 152, 219])],
			ephemeral: true
		});
	}
}

function usage(command: MixedCommand): string {
	if (command.name === "lint") return "";

	return command.options.slashOptions.map(option => option.required ? `<${option.name.replace("_", " ")}>` : `[${option.name.replace("_", " ")}]`).join(" ");
}