import { WebhookClient } from "discord.js";
import got from "got/dist/source";
import cron, { ScheduledTask } from "node-cron";
import { KTANEClient } from "./bot";
import { sendWebhookMessage } from "./bot-utils";
import tokens from "./get-tokens";
import Logger from "./log";

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

	const client = KTANEClient.instance;
	const videosAnnounced: string[] = client.settings.get("global", "videosAnnounced", []);
	const videoChannels: VideoChannel[] = client.settings.get("global", "videoChannels", []);
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
				sendWebhookMessage(client, videoBot, `New video by ${videoChannel.mention}: **${snippet.title}**: https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`, {})
					.catch(Logger.error);
				Logger.info(`Announced ${videoChannel.name} video ${snippet.title} (${snippet.resourceId.videoId}).`);
			}

			Logger.info(`Video channel ${videoChannel.name} checked.`);
			await client.settings.set("global", "videosAnnounced", videosAnnounced);
		} catch (error) {
			Logger.error(`Failed to get videos at "${`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${videoChannel.id}&key=<KEY>`}", error: ${error}`);
		}
	}
}

let scheduledTask: ScheduledTask | null = null;
export function setupVideoTask(): void {
	if (scheduledTask !== null) {
		scheduledTask.destroy();
		scheduledTask = null;
	}

	// The math below is based on this equation: 10000 (quota limit) = 1440 (minutes in a day) / minutes * channels * 3 (each request is 3 quota), solved for the variable minutes.
	// This is to prevent going over the YouTube API quota.
	const channelCount = KTANEClient.instance.settings.get("global", "videoChannels", []).length;
	scheduledTask = cron.schedule(`*/${Math.ceil(54 / 125 * channelCount) + 1} * * * *`, () => {
		scanVideos().catch(Logger.errorPrefix("Failed to run scheduled tasks:"));
	});
}