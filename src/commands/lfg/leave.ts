import { Command } from "discord-akairo";
import { Message } from "discord.js";
import { LFG } from "../../lfg";

export default class LFGLeaveCommand extends Command {
	constructor() {
		super("lfg-leave", {
			category: "lfg",
			channel: "dm"
		});
	}

	async exec(message: Message): Promise<void> {
		for (const player of LFG.players) {
			if (player.user == message.author.id) {
				if (player.message != null) {
					const lfgMessage = await message.channel.messages.fetch(player.message);
					await lfgMessage.delete();
				}

				break;
			}
		}

		LFG.leave(message.author.id);
	}
}