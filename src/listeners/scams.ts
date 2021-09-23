import { Listener } from "discord-akairo";
import { Message, MessageEmbed, Snowflake, Util } from "discord.js";
import { unpartial } from "../bot-utils";
import { DBKey } from "../db";

export default class CommandBlockedListener extends Listener {
	lastWarning: { [user: Snowflake]: number | undefined };

	constructor() {
		super("scams", {
			emitter: "client",
			event: "messageCreate"
		});

		this.lastWarning = {};
	}

	async exec(message: Message): Promise<void> {
		if (!await unpartial(message) || !message.deletable || message.guild === null)
			return;

		const content = message.content.toLowerCase();
		const hasURL = content.split(" ").some(part => {
			try {
				new URL(part);
				return true;
			} catch {
				return false;
			}
		});

		if (content.includes("discord") && content.includes("nitro") && content.includes("free") && hasURL) {
			await message.delete();

			const author = message.author;
			let warning = this.lastWarning[author.id];
			if (warning !== undefined && Date.now() - warning > 1000 * 60 * 5) {
				delete this.lastWarning[author.id];
				warning = undefined;
			}

			if (warning !== undefined)
				return;

			const channelID = await this.client.db.get<Snowflake>(message.guild, DBKey.AuditLog);
			if (channelID === undefined)
				return;

			const channel = await this.client.channels.fetch(channelID);
			if (channel?.isText()) {
				await channel.send({
					embeds: [
						new MessageEmbed({
							title: "Scam Message Deleted",
							description: `**Original message:**\n${Util.escapeMarkdown(message.content)}`,
							author: {
								iconURL: author.displayAvatarURL(),
								name: `${author.username}#${author.discriminator} (${author.id})`
							},
							color: Util.resolveColor("RED")
						})
					]
				});

				this.lastWarning[author.id] = Date.now();
			}
		}
	}
}