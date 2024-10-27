import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { ApplicationCommandOptionType, EmbedBuilder, WebhookClient } from "discord.js";
import { sendWebhookMessage } from "../../bot-utils.js";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";

@ApplyOptions<MixedOptions>({
	name: "make-major",
	aliases: ["makemajor", "mm"],
	description: "Makes a minor announcement message a major announcement.",
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "message", type: ApplicationCommandOptionType.String, description: "The ID of the message you want to make major." }
	]
})
export default class MakeMajorCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const message = await args.pick({ name: "message", type: "message" });

		if (message.embeds.length != 1) {
			await msg.reply({ content: "Invalid number of embeds on target message.", ephemeral: true });
			return;
		}

		const targetEmbed = message.embeds[0];
		if (targetEmbed.timestamp === null || targetEmbed.title === null || targetEmbed.url === null || targetEmbed.description == null)
			return;

		const embed = new EmbedBuilder({
			title: targetEmbed.title,
			url: targetEmbed.url,
			description: targetEmbed.description,
			author: {
				name: targetEmbed.author?.name ?? "",
				icon_url: targetEmbed.author?.iconURL,
				url: targetEmbed.author?.url
			},
			thumbnail: {
				url: targetEmbed.thumbnail?.url ?? ""
			},
			timestamp: targetEmbed.timestamp
		});

		embed.setColor("#0055aa");

		sendWebhookMessage(this.container.client, new WebhookClient(tokens.majorWebhook), {
			content: message.content,
			embeds: [
				embed
			],
		}).then(message => message.crosspost()).catch(Logger.error);

		message.delete().catch(Logger.error);
	}
}