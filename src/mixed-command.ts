import { Args, Awaitable, Command } from "@sapphire/framework";
import { Message, User } from "discord.js";

export abstract class MixedCommand extends Command {
	public override chatInputRun(interaction: MixedChatInputInteraction, args: Args): Awaitable<unknown> {
		interaction.author = interaction.user;
		interaction.delete = function () { return Promise.resolve(this); };

		return this.run(interaction, args);
	}

	public override messageRun(message: Message, args: Args): Awaitable<unknown> {
		return this.run(message, args);
	}

	public abstract run(interaction: MixedInteraction, args: Args): Awaitable<unknown>;
}

export type MixedInteraction = MixedChatInputInteraction | Message;
export type MixedChatInputInteraction = Command.ChatInputCommandInteraction & { author: User, delete: () => Promise<MixedChatInputInteraction> };