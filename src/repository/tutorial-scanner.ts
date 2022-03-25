import { Message } from "discord.js";
import got from "got";
import { KTANEClient } from "../bot";
import { update } from "../bot-utils";

async function getModuleNames() {
	const json = await got("https://ktane.timwi.de/json/raw").json<{ KtaneModules: { Name: string }[] }>();
	return json.KtaneModules.map(module => module.Name);
}

export async function scanForTutorials(message: Message): Promise<void> {
	// Sometimes discord.js will get the message before Discord adds the embeds.
	if (message.embeds.length === 0) {
		// I don't know if there's a proper way to do this besides just waiting and fetching the mesage again.
		await new Promise(resolve => setTimeout(resolve, 1000));

		message = await message.fetch(true);
	}

	if (message.guild === null) return;

	const files = [];
	for (const embed of message.embeds) {
		if (embed.video === null || embed.title === null || embed.url === null) continue;

		const matches = /ktane(?: ?. ?)?how to(?: ?. ?)?(.+)/i.exec(embed.title.replace(/\s+/g, " "));
		if (matches === null) continue;

		const moduleNames = (await getModuleNames()).filter(name => name.toLowerCase() == matches[1].toLowerCase());
		if (moduleNames.length !== 1) continue;

		const moduleName = moduleNames[0];
		const response = await got(`https://raw.githubusercontent.com/Timwi/KtaneContent/master/JSON/${moduleName}.json`).text();

		if (response.includes("\"TutorialVideoUrl\":")) continue;

		const lines = response.split("\n");
		const url = embed.url.replace("https://www.youtube.com/watch?v=", "https://youtu.be/");
		lines.splice(lines.length - 2, 0, `  "TutorialVideos": [ {\n    "Language": "English",\n    "Url": "${url}"\n  } ],`);
		files.push({ name: `${moduleName}.json`, attachment: Buffer.from(lines.join("\n")) });
	}

	if (files.length === 0) return;

	const report = await message.reply({
		content: "JSON with the tutorial added:",
		files
	});

	await update<Record<string, string>>(KTANEClient.instance.settings, message.guild.id, "reportMessages", {}, (value) => {
		value[message.id] = report.id;
		return value;
	});
}