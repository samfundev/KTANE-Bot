import { AkairoClient } from "discord-akairo";
import langs from "langs";

export function parseLanguage(phrase: string): string | null {
	const lowercasePhrase = phrase.toLowerCase();
	for (const language of langs.all()) {
		for (const value of Object.values(language)) {
			if (value.toLowerCase() === lowercasePhrase) {
				return language.name;
			}
		}
	}

	return null;
}

export function compareLanguage(user1: string, user2: string, client: AkairoClient): boolean {
	const storedLanguages: { [id: string]: string[] } = client.settings.get("global", "languages", {});

	const languages1 = storedLanguages[user1] ?? ["English"];
	const languages2 = storedLanguages[user2] ?? ["English"];

	for (const language of languages1) {
		if (languages2.includes(language)) {
			return true;
		}
	}

	return false;
}