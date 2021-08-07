import { Command } from "discord-akairo";
import { Message } from "discord.js";
import { update } from "../../bot-utils";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import { setupVideoTask, VideoChannel } from "../../video";

export default class YTChannelCommand extends Command {
	constructor() {
		super("yt-channel", {
			aliases: ["channel", "ytchannel"],
			category: "administration",
			description: ["Adds a YouTube channel to the bot.", "<name> is the name of the user whose channel is being added.", "<mention> should be the mention for the Discord user associated with the channel.", "<channel id> should be a YT channel ID: UC_x5XG1OV2P6uZZ5FSM9Ttw"],
			channel: "guild",

			args: [
				{
					id: "name",
					type: "string"
				},
				{
					id: "mention",
					type: "string"
				},
				{
					id: "id",
					type: "string"
				}
			]
		});

		this.usage = "<name> <mention> <channel id>";
	}

	exec(msg: GuildMessage, channel: VideoChannel): Promise<Message> {
		if (!/^U[CU][0-9A-Za-z_-]{21}[AQgw]$/.test(channel.id))
			return msg.reply("Invalid YT channel ID.");

		if (channel.id.startsWith("UC"))
			channel.id = `UU${channel.id.substring(2)}`;

		return update<VideoChannel[]>(this.client.settings, "global", "videoChannels", [], channels => {
			channels.push(channel);
			return channels;
		})
			.then(() => {
				setupVideoTask();
				return msg.reply("Added channel successfully.");
			})
			.catch(Logger.errorReply("add channel", msg));
	}
}