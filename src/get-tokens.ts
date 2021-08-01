import { Snowflake } from "discord.js";
import tokensRaw from "./tokens.json";
const tokens: tokens = tokensRaw;

interface tokens {
	botToken: string,
    announcementWebhook: { id: Snowflake, token: string },
    majorWebhook: { id: Snowflake, token: string },
    minorWebhook: { id: Snowflake, token: string },
    youtubeAPIKey: string,
    roleIDs: {
        streaming: Snowflake,
        voiceMuted: Snowflake,
        noReaction: Snowflake,
        moderator: Snowflake,
        maintainer: Snowflake,
        assignable: { aliases: string[], roleID: Snowflake, prereq?: Snowflake[] }[],
        modAssignable: { aliases: string[], roleID: Snowflake }[]
    },
    autoManagedCategories: {
		[id: string]: { channelPrefix: string, names?: string[] | null, ignoredChannels?: string[] }
    },
    reactionMenus: {
		[id: string]: { [emoji: string]: string }
    },
    requestsChannel: Snowflake,
    repoLintPath: string,
    debugging: boolean
}

export default tokens;