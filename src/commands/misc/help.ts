import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { Message, MessageEmbed } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "help",
	aliases: ["h"],
	description: "Gives info about how a command works.",
})
export default class HelpCommand extends Command {
	usage = "<command>";

	async messageRun(msg: Message, args: Args): Promise<void> {
		const command = await args.peek("command");
		await msg.reply({
			embeds: [new MessageEmbed({
				title: `${command.name} ${command.usage ?? ""}`,
				description: `${command.description}\n\n**Aliases:** ${command.aliases.join(", ")}`,
			}).setColor([52, 152, 219])]
		});
	}
}