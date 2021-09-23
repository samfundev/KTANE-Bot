import { Command } from "discord-akairo";
import { GuildChannel } from "discord.js";
import { DBKey } from "../../db";
import GuildMessage from "../../guild-message";

export default class SetChannelCommand extends Command {
	constructor() {
		super("set-channel", {
			aliases: ["setchannel"],
			category: "administration",
			description: ["Marks a channel for the bot to use.", "<type> can be requests or auditlog."],
			channel: "guild",

			args: [
				{
					id: "type",
					type: "string"
				},
				{
					id: "channel",
					type: "channel"
				}
			]
		});

		this.usage = "<type> <channel>";
	}

	async exec(msg: GuildMessage, { type, channel }: { type: string, channel: GuildChannel }): Promise<void> {
		const channelTypes: { [type: string]: DBKey | undefined } = {
			requests: DBKey.RequestsChannel,
			auditlog: DBKey.AuditLog,
		};

		const channelType = channelTypes[type];
		if (channelType === undefined) {
			await msg.reply(`Unknown channel type ${type}.`);
			return;
		}

		await this.client.db.set(msg.guild, channelType, channel.id);
		await msg.reply(`Set ${channel.name} to ${type}.`);
	}
}