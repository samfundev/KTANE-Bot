import { Command } from "discord-akairo";
import { Message, MessageEmbed } from "discord.js";

export default class HelpCommand extends Command {
	constructor() {
		super("help", {
			aliases: ["help", "h"],
			category: "misc",
			description: "Gives info about how a command works.",
			args: [
				{
					id: "command",
					type: "commandAlias"
				}
			]
		});

		this.usage = "<command>";
	}

	exec(msg: Message, { command }: { command: Command }): Promise<Message> {
		return msg.reply({
			embeds: [new MessageEmbed({
				title: `${command.aliases[0]} ${command.usage ?? ""}`,
				description: `${command.description}\n\n**Aliases:** ${command.aliases.join(", ")}`,
			}).setColor([52, 152, 219])]
		});
	}
}