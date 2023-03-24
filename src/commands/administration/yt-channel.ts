import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { update } from "../../bot-utils";
import GuildMessage from "../../guild-message";
import Logger from "../../log";
import { setupVideoTask, VideoChannel } from "../../video";

@ApplyOptions<Command.Options>({
	name: "yt-channel",
	aliases: ["channel", "ytchannel"],
	description: ["Adds a YouTube channel to the bot.", "<user> is the user whose channel is being added.", "<channel id> should be a YT channel ID: UC_x5XG1OV2P6uZZ5FSM9Ttw"].join("\n"),
	runIn: "GUILD_ANY",
})
export default class YTChannelCommand extends Command {
	usage = "<user> <channel id>";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const user = await args.pick("user");
		const id = await args.pick("string");

		const channel: VideoChannel = {
			name: user.username,
			mention: user.toString(),
			id
		};

		if (!/^U[CU][0-9A-Za-z_-]+[AQgw]$/.test(channel.id)) {
			await msg.reply("Invalid YT channel ID.");
			return;
		}

		if (channel.id.startsWith("UC"))
			channel.id = `UU${channel.id.substring(2)}`;

		update<VideoChannel[]>(container.db, "global", "videoChannels", [], channels => {
			channels.push(channel);
			return channels;
		})
			.then(async () => {
				setupVideoTask();
				await msg.reply("Added channel successfully.");
			})
			.catch(Logger.errorReply("add channel", msg));
		return;
	}
}