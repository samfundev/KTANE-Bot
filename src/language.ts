import { container } from "@sapphire/framework";
import langs from "langs";
import { DB } from "./db";

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

export function compareLanguage(user1: string, user2: string): boolean {
	const storedLanguages: { [id: string]: string[] } = container.db.get(DB.global, "languages", {});

	const languages1 = storedLanguages[user1] ?? ["English"];
	const languages2 = storedLanguages[user2] ?? ["English"];

	for (const language of languages1) {
		if (languages2.includes(language)) {
			return true;
		}
	}

	return false;
}