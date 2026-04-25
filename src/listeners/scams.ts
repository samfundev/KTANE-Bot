import { ApplyOptions } from "@sapphire/decorators";
import { container, Listener } from "@sapphire/framework";
import { remove } from "confusables";
import { Message, EmbedBuilder, Snowflake, ChannelType, escapeMarkdown, resolveColor } from "discord.js";
import { isModerator, unpartial } from "../bot-utils.js";
import { DBKey } from "../db.js";
import checkMessage from "../phishing-domains.js";

@ApplyOptions<Listener.Options>({ event: "messageCreate" })
export default class ScamMessageListener extends Listener {
	private readonly lastWarning: { [user: Snowflake]: number | undefined } = {};

	async run(message: Message): Promise<void> {
		const { client } = this.container;
		if (!await unpartial(message) || !message.deletable || message.guild === null || message.member === null || message.author.bot || isModerator(message))
			return;

		const text = [message.content, ...message.embeds.flatMap(embed => [embed.title, embed.description])].join(" ");
		const content = remove(text).toLowerCase();
		const hasURL = content.split(/\s/).some(part => {
			try {
				new URL(part);
				return true;
			} catch {
				return false;
			}
		});

		let score = 0;

		if (hasURL) score += 1;

		const words = [
			"discord",
			"nitro",
			"free",
			"steam",
			"@everyone",
			"@here"
		];

		score += words.filter(word => content.includes(word)).length;

		if (score >= 4 || await checkMessage(message)) {
			await message.delete();
			await message.member.timeout(1000 * 60 * 60 * 24, "Scam message.");
			await message.member.send("You've been automatically timed out for a possible scam message. If this action was done incorrectly, please message the moderation team through <@575252669443211264>.");

			const author = message.author;
			let warning = this.lastWarning[author.id];
			if (warning !== undefined && Date.now() - warning > 1000 * 60 * 5) {
				delete this.lastWarning[author.id];
				warning = undefined;
			}

			if (warning !== undefined)
				return;

			const channelID = container.db.getOrUndefined<Snowflake>(message.guild, DBKey.AuditLog);
			if (channelID === undefined)
				return;

			const channel = await client.channels.fetch(channelID);
			if (channel?.type === ChannelType.GuildText) {
				await channel.send({
					content: `Scam message deleted in ${message.channel}.`,
					embeds: [
						new EmbedBuilder({
							description: escapeMarkdown(message.content),
							author: {
								iconURL: author.displayAvatarURL(),
								name: `${author.username}#${author.discriminator} (${author.id})`
							},
							color: resolveColor("Red")
						})
					]
				});

				this.lastWarning[author.id] = Date.now();
			}
		}
	}
}