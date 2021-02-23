import { Command } from "discord-akairo";
import { Message } from "discord.js";
import { LFG } from "../../lfg";
import Logger from "../../log";

export default class LFGInviteCommand extends Command {
	constructor() {
		super("lfg-invite", {
			category: "lfg",
			channel: "dm",
			args: [
				{
					id: "players",
					type: "integer",
					match: "separate"
				}
			]
		});
	}

	async exec(message: Message, { players }: { players: number[] }): Promise<void> {
		LFG.invite(message, players).catch(Logger.errorReply("invite users", message));
	}
}