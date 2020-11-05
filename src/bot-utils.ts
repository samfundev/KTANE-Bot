import { Provider } from "discord-akairo";
import { RESTPostAPIChannelMessageResult } from "discord-api-types/v8";
import { Client, Message, WebhookClient, WebhookMessageOptions } from "discord.js";
import tokens from "./get-tokens";
import Logger from "./log";

export async function unpartial<T>(target: T & { partial: boolean, fetch: () => Promise<T> }): Promise<boolean> {
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

export function isModerator(message: Message): boolean {
	if (message.guild == null || message.member == null)
		return false;

	const role = message.guild.roles.cache.get(tokens.roleIDs.moderator);
	if (!role)
		return false;

	return message.member.roles.highest.comparePositionTo(role) >= 0;
}

export async function sendWebhookMessage(client: Client, webhook: WebhookClient, content: string, options: WebhookMessageOptions): Promise<Message> {
	const message = ((await webhook.send(content, options)) as unknown) as RESTPostAPIChannelMessageResult;

	const channel = await client.channels.fetch(message.channel_id);
	if (!channel.isText())
		throw new Error("Not a text channel.");

	return await channel.messages.fetch(message.id);
}

export async function update<T>(provider: Provider, id: string, key: string, defaultValue: T, updater: (value: T) => T): Promise<void> {
	const oldValue = await provider.get(id, key, defaultValue);
	const newValue = updater(oldValue);
	await provider.set(id, key, newValue);
}