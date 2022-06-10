import { Message } from "discord.js";
import got from "./utils/got-traces";
import * as psl from "psl";

let phishingDomains: Set<string> = new Set();
let lastUpdate: number | null = null;

export default async function checkMessage(message: Message): Promise<boolean> {
	// Grab the initial list of domains.
	if (lastUpdate === null) {
		const response = await got("https://phish.sinking.yachts/v2/all");
		phishingDomains = new Set(JSON.parse(response.body));

		lastUpdate = Date.now();
	}

	// Every hour, update the domain list with recently added domains.
	const difference = (Date.now() - lastUpdate) / 1000;
	if (difference >= 60 * 60) {
		// Add a bit of wiggle room, just in case.
		const response = await got(`https://phish.sinking.yachts/v2/recent/${difference + 60}`);
		const recentDomains = JSON.parse(response.body) as string[];

		// Add any new domains.
		for (const domain of recentDomains) {
			phishingDomains.add(domain);
		}

		lastUpdate = Date.now();
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