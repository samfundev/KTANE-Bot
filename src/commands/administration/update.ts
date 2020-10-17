import { Command } from "discord-akairo";
import { Message } from "discord.js";

export default class UpdateCommand extends Command {
	constructor() {
		super("update", {
			aliases: ["update", "u"],
			category: "administration",
			description: "Updates the bot.",
			ownerOnly: true
		});
	}

	exec(msg: Message): void {
		if (msg.guild != null)
			return;

		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			var { elevate } = require("node-windows");
		} catch {
			return;
		}

		this.client.settings.set("global", "updating", true);
		elevate("update.bat");
	}
}