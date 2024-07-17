import { container } from "@sapphire/framework";
import { ChannelType, Snowflake, WebhookClient } from "discord.js";
import got from "got";
import { CronJob } from "cron";
import { sendWebhookMessage } from "./bot-utils.js";
import { DB } from "./db.js";
import { DBKey } from "./db.js";
import tokens from "./get-tokens.js";
import Logger from "./log.js";
import { respondToVideos } from "./repository/tutorial-scanner.js";

export type VideoChannel = {
	name: string,
	mention: string,
	id: string
}

type playlistItem = {
	snippet: {
		title: string,
		resourceId: {
			videoId: string
		}
	}
}

const videoBot = new WebhookClient(tokens.announcementWebhook);

export async function scanVideos(): Promise<void> {
	if (tokens.debugging) return;
	// Scan for new KTANE-related YouTube videos

	const { client } = container;
	const videosAnnounced: string[] = container.db.get(DB.global, "videosAnnounced", []);
	const videoChannels: VideoChannel[] = container.db.get(DB.global, "videoChannels", []);
	const announcedItems: playlistItem[] = [];
	for (const videoChannel of videoChannels) {
		try {
			const response = await got(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=${tokens.youtubeAPIKey}`, {
				responseType: "json"
			});
			const json = response.body as { items: playlistItem[] };

			for (const item of json.items.reverse()) {
				const snippet = item.snippet;
				if (videosAnnounced.includes(snippet.resourceId.videoId))
					continue;
				if (snippet.title.toLowerCase().indexOf("ktane") === -1 &&
					snippet.title.toLowerCase().indexOf("keep talking and nobody explodes") === -1)
					continue;
				videosAnnounced.push(snippet.resourceId.videoId);
				announcedItems.push(item);
				sendWebhookMessage(client, videoBot, { content: `New video by ${videoChannel.mention}: **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}` })
					.catch(Logger.error);
				Logger.info(`Announced ${videoChannel.name} video ${snippet.title} (${snippet.resourceId.videoId}).`);
			}

			Logger.info(`Video channel ${videoChannel.name} checked.`);
		} catch (error) {
			Logger.error(`Failed to get videos at "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=<KEY>", error: ${error}`);
		}
	}

	container.db.set(DB.global, "videosAnnounced", videosAnnounced);

	// Look for tutorial videos to post in the requests channel
	const tutorialResponse = await respondToVideos(announcedItems.map(item => ({ title: item.snippet.title, url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}` })));
	if (tutorialResponse !== null) {
		for (const guild of client.guilds.cache.values()) {
			const requestsID = container.db.getOrUndefined<Snowflake>(guild, DBKey.RequestsChannel);
			if (requestsID === undefined) continue;

			const channel = await client.channels.fetch(requestsID);
			if (channel?.type !== ChannelType.GuildText) continue;

			await channel.send(tutorialResponse);
		}
	}
}

let scheduledTask: CronJob | null = null;
export function setupVideoTask(): void {
	if (scheduledTask !== null) {
		scheduledTask.stop();
		scheduledTask = null;
	}

	// The math below is based on this equation: 10000 (quota limit) = 1440 (minutes in a day) / minutes * channels * 3 (each request is 3 quota), solved for the variable minutes.
	// This is to prevent going over the YouTube API quota.
	const channelCount = container.db.get(DB.global, "videoChannels", []).length;
	scheduledTask = CronJob.from({
		cronTime: `*/${Math.ceil(54 / 125 * channelCount) + 1} * * * *`,
		onTick: () => {
			scanVideos().catch(Logger.errorPrefix("Failed to run scheduled tasks:"));
		},
		start: true
	});
}