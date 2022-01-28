import { Listener } from "discord-akairo";
import { Message } from "discord.js";
import { unpartial } from "../bot-utils";
import { DBKey } from "../db";
import { scanForTutorials } from "../repository/tutorial-scanner";

export default class CommandBlockedListener extends Listener {
	constructor() {
		super("tutorial-videos", {
			emitter: "client",
			event: "messageCreate"
		});
	}

	async exec(message: Message): Promise<void> {
		if (!await unpartial(message) || message.guild === null || message.author.bot)
			return;

		const requestsID = await this.client.db.get(message.guild, DBKey.RequestsChannel);
		if (message.channel.id === requestsID) {
			await scanForTutorials(message);
		}
	}
}