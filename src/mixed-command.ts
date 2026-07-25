import { Args, Awaitable, Command } from "@sapphire/framework";
import {
	APIApplicationCommandOption,
	APIApplicationCommandSubcommandOption,
	CacheType,
	Message,
	SlashCommandChannelOption,
	SlashCommandStringOption,
	SlashCommandUserOption,
	User,
} from "discord.js";

export abstract class MixedCommand extends Command<Args, MixedOptions> {
	public override chatInputRun(
		interaction: MixedChatInputInteraction,
		args: Args,
	): Awaitable<unknown> {
		interaction.author = interaction.user;
		interaction.delete = function () {
			return Promise.resolve(this);
		};
		interaction.subcommand = interaction.options.data[0]?.name ?? null;

		return this.run(interaction as MixedInteraction, args);
	}

	public override messageRun(message: MixedMessage, args: Args): Awaitable<unknown> {
		message.subcommand = null;
		return this.run(message, args);
	}

	public abstract run(
		interaction: MixedInteraction,
		args: Args,
	): Awaitable<unknown>;

	public override registerApplicationCommands(registry: Command.Registry) {
		if (this.options.slashOptions === undefined) return;

		registry.registerChatInputCommand((builder) => {
			if (this.options.slashOptions === undefined) return;

			builder
				.setName(this.name)
				.setDescription(this.description.split("\n")[0]);
			for (const slashOption of this.options.slashOptions) {
				builder.options.push({
					toJSON: () =>
						({ required: true, ...slashOption }) as APIApplicationCommandOption,
				});
			}
		});
	}
}

export interface MixedOptions extends Command.Options {
	slashOptions: SlashOption[];
	ephemeral?: true;
}

type OmitFunctions<T> = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	[P in keyof T as T[P] extends Function ? never : P]: T[P];
};
type SlashOption = OmitUnion<
	OmitFunctions<
		| SlashCommandStringOption
		| SlashCommandUserOption
		| SlashCommandChannelOption
		| APIApplicationCommandSubcommandOption
	>,
	"required"
> & { required?: false };
export type MixedInteraction<InGuild extends boolean = boolean> =
	| (MixedChatInputInteraction<InGuild extends true ? "cached" : "raw">
		| MixedMessage<InGuild>) & { subcommand: string | null };
export type MixedChatInputInteraction<Cached extends CacheType = CacheType> =
	Command.ChatInputCommandInteraction<Cached> & {
		author: User;
		delete: () => Promise<MixedChatInputInteraction>;
		subcommand: string | null;
	};

type MixedMessage<InGuild extends boolean = boolean> = Message<InGuild> & {
	subcommand: string | null;
};

type OmitUnion<T, K> = {
	[P in keyof T as Exclude<P, K & keyof any>]: T[P];
};
