import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import { Message } from "discord.js";
import { unpartial } from "../bot-utils.js";
import { DBKey } from "../db.js";
import { scanForTutorials } from "../repository/tutorial-scanner.js";

@ApplyOptions<Listener.Options>({ event: "messageCreate" })
export default class TutorialMessageListener extends Listener {
	async run(message: Message): Promise<void> {
		if (!await unpartial(message) || message.guild === null || message.author.bot)
			return;

		const requestsID = await this.container.db.getOrUndefined(message.guild, DBKey.RequestsChannel);
		if (message.channel.id === requestsID) {
			await scanForTutorials(message);
		}
	}
}