import { Command } from "discord-akairo";
import { MessageEmbed, TextChannel, WebhookClient } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";

export default class MakeMajorCommand extends Command {
	constructor() {
		super("make-major", {
			aliases: ["makemajor", "mm"],
			category: "administration",
			description: "Makes a minor announcement message a major announcement.",
			channel: "guild",

			args: [
				{
					id: "messageid",
					type: "string"
				}
			]
		});
	}

	exec(msg: GuildMessage, args: { messageid: string }): void {
		const channel = msg.guild.channels.cache.find(channel => channel.name == "mods-minor" && channel.type === "news") as TextChannel;
		channel.messages.fetch(args.messageid).then(message => {
			if (message.embeds.length != 1) {
				msg.reply("Invalid number of embeds on target message.");
				return;
			}

			const targetEmbed = message.embeds[0];
			if (targetEmbed.timestamp == null)
				return;

			const embed = new MessageEmbed({
				title: targetEmbed.title,
				url: targetEmbed.url,
				description: targetEmbed.description,
				author: {
					name: targetEmbed.author?.name,
					icon_url: targetEmbed.author?.iconURL,
					url: targetEmbed.author?.url
				},
				thumbnail: {
					url: targetEmbed.thumbnail?.url
				},
				timestamp: targetEmbed.timestamp
			});
	
			embed.setColor("#0055aa");

			new WebhookClient(tokens.majorWebhook.id, tokens.majorWebhook.token).send(message.content, {
				disableMentions: "all",
				embeds: [
					embed
				],
			});

			message.delete().catch(Logger.error);
		}).catch(Logger.errorReply("make the message major", msg));
	}
}