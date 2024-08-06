import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { ChannelType, EmbedBuilder, TextChannel, WebhookClient } from "discord.js";
import { sendWebhookMessage } from "../../bot-utils.js";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import Logger from "../../log.js";

@ApplyOptions<Command.Options>({
	name: "make-major",
	aliases: ["makemajor", "mm"],
	description: "Makes a minor announcement message a major announcement.",
	runIn: "GUILD_ANY"
})
export default class MakeMajorCommand extends Command {
	usage = "<message id>";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const channel = msg.guild.channels.cache.find(channel => channel.name == "mods-minor" && channel.type === ChannelType.GuildAnnouncement) as TextChannel;
		const messageID = await args.pick({ name: "messageID", type: "string" });

		channel.messages.fetch(messageID).then(async message => {
			if (message.embeds.length != 1) {
				await msg.reply("Invalid number of embeds on target message.");
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
		}).catch(Logger.errorReply("make the message major", msg));
	}
}