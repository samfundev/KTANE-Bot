import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";

@ApplyOptions<Command.Options>({
	name: "help",
	aliases: ["h"],
	description: "Gives info about how a command works.",
})
export default class HelpCommand extends MixedCommand {
	usage = "<command>";

	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const command = await args.peek({ name: "command", type: "command" });
		await msg.reply({
			embeds: [new EmbedBuilder({
				title: `${command.name} ${command.usage ?? ""}`,
				description: `${command.description}\n\n**Aliases:** ${command.aliases.join(", ")}`,
			}).setColor([52, 152, 219])]
		});
	}
}