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

		let elevate;
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { elevateFunc } = require("node-windows");
			elevate = elevateFunc;
		} catch {
			return;
		}

		this.client.settings.set("global", "updating", true);
		elevate("update.bat");
	}
}