import { Args, Awaitable, Command } from "@sapphire/framework";
import { APIApplicationCommandOption, CacheType, Message, SlashCommandChannelOption, SlashCommandStringOption, SlashCommandUserOption, User } from "discord.js";

export abstract class MixedCommand extends Command<Args, MixedOptions> {
	public override chatInputRun(interaction: MixedChatInputInteraction, args: Args): Awaitable<unknown> {
		interaction.author = interaction.user;
		interaction.delete = function () { return Promise.resolve(this); };

		return this.run(interaction as MixedInteraction, args);
	}

	public override messageRun(message: Message, args: Args): Awaitable<unknown> {
		return this.run(message, args);
	}

	public abstract run(interaction: MixedInteraction, args: Args): Awaitable<unknown>;

	public override registerApplicationCommands(registry: Command.Registry) {
		if (this.options.slashOptions === undefined) return;

		registry.registerChatInputCommand((builder) => {
			if (this.options.slashOptions === undefined) return;

			builder.setName(this.name)
				.setDescription(this.description.split("\n")[0])
			for (const slashOption of this.options.slashOptions) {
				builder.options.push({ toJSON: () => ({ required: true, ...slashOption }) as APIApplicationCommandOption });
			}
		})
	}
}

export interface MixedOptions extends Command.Options {
	slashOptions: SlashOption[];
	ephemeral?: true;
}

type OmitFunctions<T> = {
	[P in keyof T as T[P] extends Function ? never : P]: T[P]
}
type SlashOption = OmitUnion<OmitFunctions<SlashCommandStringOption | SlashCommandUserOption | SlashCommandChannelOption>, "required"> & { required?: false };
export type MixedInteraction<InGuild extends boolean = boolean> = MixedChatInputInteraction<InGuild extends true ? "cached" : "raw"> | Message<InGuild>;
export type MixedChatInputInteraction<Cached extends CacheType = CacheType> = Command.ChatInputCommandInteraction<Cached> & { author: User, delete: () => Promise<MixedChatInputInteraction> };

type OmitUnion<T, K> = {
	[P in keyof T as Exclude<P, K & keyof any>]: T[P];
};