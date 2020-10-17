import { GuildMember } from 'discord.js';
import { Guild } from 'discord.js';
import { Message } from 'discord.js';

type GuildMessage = Message & { guild: Guild, member: GuildMember };

export default GuildMessage;