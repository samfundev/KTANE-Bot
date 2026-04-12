import { ApplyOptions } from "@sapphire/decorators";
import { container, Listener } from "@sapphire/framework";
import { remove } from "confusables";
import { Message, EmbedBuilder, Snowflake, ChannelType, escapeMarkdown, resolveColor } from "discord.js";
import { isModerator, unpartial } from "../bot-utils.js";
import { DB, DBKey } from "../db.js";
import checkMessage from "../phishing-domains.js";
import TaskManager from "../task-manager.js";

@ApplyOptions<Listener.Options>({ event: "messageCreate" })
export default class ScamMessageListener extends Listener {
	private readonly lastWarning: { [user: Snowflake]: number | undefined } = {};

	async run(message: Message): Promise<void> {
		const { client } = this.container;
		if (!await unpartial(message) || !message.deletable || message.guild === null || message.member === null || message.author.bot || isModerator(message))
			return;

		this.trackRapidChannelPosting(message);

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

	private readonly recentChannelPosts: { [user: Snowflake]: { [channelID: Snowflake]: number } | undefined } = {};
	private readonly channelBurstWindowMS = 1000 * 5;
	private readonly channelBurstThreshold = 3;
	private readonly maxRecordedBursts = 5000;
	private readonly timeouts: { [user: Snowflake]: NodeJS.Timeout | undefined } = {};

	private trackRapidChannelPosting(message: Message): void {
		const userID = message.author.id;
		const timestamp = Date.now();
		const earliestTimestamp = timestamp - this.channelBurstWindowMS;

		let posts = this.recentChannelPosts[userID];
		if (!posts)
			posts = this.recentChannelPosts[userID] = {};

		posts[message.channel.id] = timestamp;

		// Remove posts that are outside the window unless they've hit the threshold.
		if (!(userID in this.timeouts)) {
			for (const [channelId, ts] of Object.entries(posts)) {
				if (ts < earliestTimestamp)
					delete posts[channelId];
			}
		}

		const uniqueChannelIDs = Object.keys(posts);
		if (uniqueChannelIDs.length < this.channelBurstThreshold) {
			return;
		}

		if (userID in this.timeouts) {
			clearTimeout(this.timeouts[userID]!);
		}

		this.timeouts[userID] = setTimeout(() => {
			this.recordBurst(userID, posts);
			delete this.recentChannelPosts[userID];
			delete this.timeouts[userID];
		}, this.channelBurstWindowMS);
	}

	private recordBurst(userID: Snowflake, posts: { [channelID: Snowflake]: number }): void {
		const timeBetweenPosts = Object.values(posts).toSorted().map((timestamp, index, sorted) => index === 0 ? 0 : timestamp - sorted[index - 1]).slice(1);

		const uniqueChannelIDs = Object.keys(posts);
		const records = container.db.get<ScamChannelBurstRecord[]>(DB.global, "scamChannelBursts", []);
		records.push({
			userID,
			recordedAt: Date.now(),
			posts,
			uniqueChannelIDs,
			timeBetweenPosts
		});

		if (records.length > this.maxRecordedBursts)
			records.splice(0, records.length - this.maxRecordedBursts);

		container.db.set(DB.global, "scamChannelBursts", records);
		const totalTime = timeBetweenPosts.reduce((a, b) => a + b, 0);
		TaskManager.sendOwnerMessage(`User <@${userID}> posted in ${uniqueChannelIDs.length} channels within a ${this.channelBurstWindowMS / 1000} second window. Total time between posts: ${totalTime} ms.`);
	}
}

interface ScamChannelBurstRecord {
	userID: Snowflake;
	recordedAt: number;
	posts: { [channelID: Snowflake]: number };
	uniqueChannelIDs: Snowflake[];
	timeBetweenPosts: number[];
}