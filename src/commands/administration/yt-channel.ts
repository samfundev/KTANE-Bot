import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { update } from "../../bot-utils.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import Logger from "../../log.js";
import { setupVideoTask, VideoChannel } from "../../video.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "yt-channel",
	aliases: ["channel", "ytchannel"],
	description: ["Adds a YouTube channel to the bot.", "<user> is the user whose channel is being added.", "<channel id> should be a YT channel ID: UC_x5XG1OV2P6uZZ5FSM9Ttw"].join("\n"),
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "user", type: ApplicationCommandOptionType.User, description: "The user whose channel you want to add." },
		{ name: "channel_id", type: ApplicationCommandOptionType.String, description: "The channel ID of the user." }
	]
})
export default class YTChannelCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const user = await args.pick({ name: "user", type: "user" });
		const id = await args.pick({ name: "channel_id", type: "string" });

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