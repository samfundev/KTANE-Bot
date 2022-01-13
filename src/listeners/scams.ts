import remove from "confusables";
import { Listener } from "discord-akairo";
import { Message, MessageEmbed, Snowflake, Util } from "discord.js";
import { isModerator, unpartial } from "../bot-utils";
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
		if (!await unpartial(message) || !message.deletable || message.guild === null || isModerator(message))
			return;

		const content = remove(message.content).toLowerCase();
		const hasURL = content.split(/\s/).some(part => {
			try {
				new URL(part);
				return true;
			} catch {
				return false;
			}
		});

		let score = 0;

		if (hasURL) score += 1;

		const words = [
			"discord",
			"nitro",
			"free",
			"steam",
			"@everyone",
			"@here"
		];

		score += words.filter(word => content.includes(word)).length;

		if (score >= 4) {
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