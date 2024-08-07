import { Message } from "discord.js";
import got from "./utils/got-traces.js";
import * as psl from "psl";
import Logger from "./log.js";

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
			const response = await got(`https://phish.sinking.yachts/v2/recent/${Math.floor(difference) + 60}`);
			const recentChanges = JSON.parse(response.body) as { type: "add" | "delete", domains: string[] }[];

			// Add any new domains.
			for (const change of recentChanges) {
				for (const domain of change.domains) {
					if (change.type === "add") phishingDomains.add(domain);
					else if (change.type === "delete") phishingDomains.delete(domain);
				}
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