import { Presence } from "discord.js";
import tokens from "./get-tokens";
import Logger from "./log";

export default async function checkStreamingStatus(presence: Presence, fetch: boolean): Promise<void> {
	if (tokens.debugging) return;

	let member = presence.member;
	if (member === null) {
		Logger.warn("Tried to check presence but there wasn't a member.");
		return;
	}

	if (fetch)
	{
		try {
			member = await member.fetch(true);
		} catch { // Failed to fetch member, we can't check the streaming status.
			return;
		}
	}

	const activities = presence.activities;
	const streamingKTANE = activities.some(game => game.type === "STREAMING" && game.state === "Keep Talking and Nobody Explodes");
	const hasRole = member.roles.cache.has(tokens.roleIDs.streaming);
	let actionTaken = null;
	if (hasRole && !streamingKTANE)
	{
		await member.roles.remove(tokens.roleIDs.streaming).catch(Logger.error);
		actionTaken = "; removing streaming role";
	}
	else if (!hasRole && streamingKTANE)
	{
		await member.roles.add(tokens.roleIDs.streaming).catch(Logger.error);
		actionTaken = "; adding streaming role";
	}
	if (actionTaken !== null)
		Logger.info(member.user.username, `${streamingKTANE ? "is streaming KTANE" : "is streaming NON-KTANE"}${actionTaken}`);
}