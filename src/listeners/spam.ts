import { ApplyOptions } from "@sapphire/decorators";
import { container, Listener } from "@sapphire/framework";
import { remove } from "confusables";
import { Message, EmbedBuilder, Snowflake, ChannelType, escapeMarkdown, resolveColor } from "discord.js";
import { isModerator, unpartial } from "../bot-utils.js";
import { DB, DBKey } from "../db.js";
import checkMessage from "../phishing-domains.js";
import TaskManager from "../task-manager.js";

@ApplyOptions<Listener.Options>({ event: "messageCreate" })
export default class SpamMessageListener extends Listener {
	private readonly lastWarning: { [user: Snowflake]: number | undefined } = {};

	async run(message: Message): Promise<void> {
		const { client } = this.container;
		if (!await unpartial(message) || !message.deletable || message.guild === null || message.member === null || message.author.bot || isModerator(message))
			return;

		if (this.isRapidChannelPosting(message)) {
			await message.member.timeout(1000 * 60 * 60 * 24, "Spam messages.");
			await message.member.send("You've been automatically timed out for possible spam messages. If this action was done incorrectly, please message the moderation team through <@575252669443211264>.");

			// Delete all recent messages.
			const userID = message.author.id;
			const posts = this.recentPosts[userID];
			if (posts) {
				for (const post of posts) {
					const channel = await client.channels.fetch(post.channelID);
					if (!channel?.isTextBased())
						continue;

					const message = await channel.messages.fetch(post.id);
					if (message)
						await message.delete();
				}
			}

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
					content: `Spam messages deleted from <@${author.id}>.`,
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

	private readonly recentPosts: { [user: Snowflake]: { channelID: Snowflake, id: Snowflake, timestamp: number }[] | undefined } = {};
	private readonly channelBurstThreshold = 3;
	private readonly channelBurstWindowMS = 2500 * (this.channelBurstThreshold - 1);

	private isRapidChannelPosting(message: Message): boolean {
		const userID = message.author.id;
		const timestamp = Date.now();
		const earliestTimestamp = timestamp - this.channelBurstWindowMS;

		let posts = this.recentPosts[userID];
		if (!posts)
			posts = this.recentPosts[userID] = [];

		posts.push({ channelID: message.channel.id, id: message.id, timestamp });

		// Remove posts that are outside the window.
		posts = posts.filter(post => post.timestamp >= earliestTimestamp);
		this.recentPosts[userID] = posts;

		const uniqueChannelIDs = new Set(posts.map(post => post.channelID));
		return (uniqueChannelIDs.size >= this.channelBurstThreshold);
	}
}