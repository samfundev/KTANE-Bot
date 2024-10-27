import { AllowedPartial, ChannelType, ChatInputCommandInteraction, Client, Message, PartialDMChannel, PartialMessage, PartialMessageReaction, WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import { DB } from "./db.js";
import tokens from "./get-tokens.js";
import Logger from "./log.js";

type Partials = PartialMessageReaction | PartialMessage | PartialDMChannel;

export async function unpartial(target: AllowedPartial | Partials): Promise<boolean> {
	if (!target.partial)
		return true;

	try {
		await target.fetch();

		return true;
	} catch (error) {
		Logger.error("Unable to unpartial:", error);
		return false;
	}
}

export function isModerator(message: Message | ChatInputCommandInteraction<"cached">): boolean {
	if (message.guild == null || message.member == null)
		return false;

	const role = message.guild.roles.cache.get(tokens.roleIDs.moderator);
	if (!role)
		return false;

	return message.member.roles.highest.comparePositionTo(role) >= 0;
}

export async function sendWebhookMessage(client: Client, webhook: WebhookClient, options: WebhookMessageCreateOptions): Promise<Message> {
	const message = await webhook.send(options);

	const channel = await client.channels.fetch(message.channel_id);
	if (channel == null || channel.type !== ChannelType.GuildText)
		throw new Error("Not a text channel.");

	return await channel.messages.fetch(message.id);
}

export async function update<T>(database: DB, id: string, key: string, defaultValue: T, updater: (value: T) => T | Promise<T>): Promise<void> {
	const oldValue = database.get({ id }, key, defaultValue);
	const newValue = await updater(oldValue);
	database.set({ id }, key, newValue);
}

// Join together an array of strings seperated by a string but don't make it longer than the limit.
// Makes sure not to partially include any element.
export function joinLimit(array: string[], seperator: string, limit: number): string {
	let joined = "";

	for (let index = 0; index < array.length; index++) {
		const element = array[index];
		if (index === 0 && element.length + joined.length > limit) {
			break;
		} else if (element.length + seperator.length + joined.length > limit) {
			break;
		}

		if (index !== 0)
			joined += seperator;

		joined += element;
	}

	return joined;
}