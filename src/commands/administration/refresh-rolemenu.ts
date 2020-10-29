import { Command } from "discord-akairo";
import { TextChannel } from "discord.js";
import tokens from "../../get-tokens";
import GuildMessage from "../../guild-message";
import Logger from "../../log";

export default class RefreshRoleMenuCommand extends Command {
	constructor() {
		super("refresh-rolemenu", {
			aliases: ["refreshrm", "refreshrolemenu"],
			category: "administration",
			description: "Refreshes a role menu.",
			channel: "guild",
			ownerOnly: true
		});
	}

	exec(msg: GuildMessage): void {
		for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus))
		{
			const [channelID, msgID] = menuMessageID.split("/");
			const channel = msg.guild.channels.cache.get(channelID) as TextChannel;
			if (!channel)
			{
				Logger.error(`Cannot find channel ${channelID}. Channels are:`);
				for (const [key, value] of msg.guild.channels.cache)
					Logger.error(` -- ${key} = ${value}`);
				continue;
			}
			channel.messages.fetch(msgID)
				.then(async(message) => {
					for (const emojiName in emojis)
						await message.react(emojiName);
				})
				.catch(Logger.error);
		}
		msg.delete().catch(Logger.error);
	}
}