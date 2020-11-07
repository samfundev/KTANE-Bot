import { Presence } from "discord.js";
import tokens from "./get-tokens";
import Logger from "./log";

export default function checkStreamingStatus(presence: Presence): void {
	if (tokens.debugging) return;

	const member = presence.member;
	if (member === null) {
		Logger.warn("Tried to check presence but there wasn't a member.");
		return;
	}

	const activities = presence.activities;
	const streamingKTANE = activities.some(game => game.type === "STREAMING" && game.state === "Keep Talking and Nobody Explodes");
	const hasRole = member.roles.cache.has(tokens.roleIDs.streaming);
	let actionTaken = null;
	if (hasRole && !streamingKTANE)
	{
		member.roles.remove(tokens.roleIDs.streaming).catch(Logger.error);
		actionTaken = "; removing streaming role";
	}
	else if (!hasRole && streamingKTANE)
	{
		member.roles.add(tokens.roleIDs.streaming).catch(Logger.error);
		actionTaken = "; adding streaming role";
	}
	if (actionTaken !== null)
		Logger.info(member.user.username, `${streamingKTANE ? "is streaming KTANE" : "is streaming NON-KTANE"}${actionTaken}`);
}