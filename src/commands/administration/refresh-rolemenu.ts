import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { TextChannel } from "discord.js";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import Logger from "../../log.js";

@ApplyOptions<Command.Options>({
	name: "refresh-rolemenu",
	aliases: ["refreshrm", "refreshrolemenu"],
	description: "Refreshes a role menu.",
	runIn: "GUILD_ANY",
	preconditions: ["OwnerOnly"]
})
export default class RefreshRoleMenuCommand extends Command {
	messageRun(msg: GuildMessage): void {
		for (const [menuMessageID, emojis] of Object.entries(tokens.reactionMenus)) {
			const [channelID, msgID] = menuMessageID.split("/");
			const channel = msg.guild.channels.cache.get(channelID) as TextChannel;
			if (!channel) {
				Logger.error(`Cannot find channel ${channelID}. Channels are:`);
				for (const [key, value] of msg.guild.channels.cache)
					Logger.error(` -- ${key} = ${value}`);
				continue;
			}
			channel.messages.fetch(msgID)
				.then(async (message) => {
					for (const emojiName in emojis)
						await message.react(emojiName);
				})
				.catch(Logger.error);
		}
		msg.delete().catch(Logger.error);
	}
}