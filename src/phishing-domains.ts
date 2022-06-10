import { Message } from "discord.js";
import got from "./utils/got-traces";
import * as psl from "psl";
import Logger from "./log";

let phishingDomains: Set<string> = new Set();
let lastUpdate: number | null = null;

/**
 * Check if a message contains a phishing domain.
 * @param message The message to check for phishing domains.
 * @returns If the message contains a phishing domain.
 */
export default async function checkMessage(message: Message): Promise<boolean> {
	// Grab the initial list of domains.
	if (lastUpdate === null) {
		try {
			const response = await got("https://phish.sinking.yachts/v2/all");
			phishingDomains = new Set(JSON.parse(response.body));

			lastUpdate = Date.now();
		} catch (err) {
			Logger.error("Unable to fetch initial phishing domain list.", err);
			return false;
		}
	}

	// Every hour, update the domain list with recently added domains.
	const difference = (Date.now() - lastUpdate) / 1000;
	if (difference >= 60 * 60) {
		try {
			// Add a bit of wiggle room, just in case.
			const response = await got(`https://phish.sinking.yachts/v2/recent/${difference + 60}`);
			const recentDomains = JSON.parse(response.body) as string[];

			// Add any new domains.
			for (const domain of recentDomains) {
				phishingDomains.add(domain);
			}

			lastUpdate = Date.now();
		} catch (err) {
			Logger.error("Unable to update phishing domain list.", err);
		}
	}

	// Check the message for URLs and see if their hostname contains a phishing domain.
	return message.content.split(/\s/).some(part => {
		try {
			const url = new URL(part);
			const domain = psl.get(url.hostname);
			if (domain === null) return false;

			return phishingDomains.has(domain);
		} catch {
			return false;
		}
	});
}