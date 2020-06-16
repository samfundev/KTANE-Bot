import { Command, CommandoClient, CommandoMessage } from "discord.js-commando"
import tokens from "./../get-tokens";
import { Role, Collection, Snowflake } from 'discord.js';
const logger = require("./../log");

function getRole(roleName: string, assignableData: Assignable[], guildRoles: Collection<string, Role>) {
	let targetRole = roleName.toLowerCase();
	for (let roleData of assignableData) {
		if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
			const role = guildRoles.get(roleData.roleID);
			if (role == undefined) {
				logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
				return;
			}

			return { role, roleData };
		}
	}
}

function shuffle(a: any[]) {
	var j, x, i;
	for (i = a.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		x = a[i];
		a[i] = a[j];
		a[j] = x;
	}
	return a;
}

interface RoleArgument {
	role: string;
}

interface Assignable {
	aliases: string[];
	roleID: Snowflake;
	prereq: Snowflake[];
}

module.exports = [
	class RoleCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "role",
				aliases: ["role", "r"],
				group: "public",
				memberName: "role",
				description: "Toggles specific roles for your user.",
				examples: ["role <rolename>", "r <rolename>"],
				guildOnly: true,

				args: [
					{
						key: "role",
						prompt: "What role do you want to toggle?",
						type: "string"
					}
				]
			});
		}

		run(msg: CommandoMessage, args: RoleArgument) {
			const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles.cache);
			if (roleInf !== undefined) {
				const { role, roleData } = roleInf;
				if (roleData.prereq && !roleData.prereq.some(pre => msg.member.roles.cache.has(pre))) {
					return msg.channel.send(`You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`);
				}
				if (msg.member.roles.cache.has(role.id)) {
					return msg.member.roles.remove(role)
						.then(() => msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`))
						.catch(logger.error);
				} else {
					return msg.member.roles.add(role)
						.then(() => msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`))
						.catch(logger.error);
				}
			}
		}
	},
	class RoleListCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "rolelist",
				aliases: ["rolelist", "rl", "roles"],
				group: "public",
				memberName: "role-list",
				description: "Lists of all the roles that can be used with the role command.",
				examples: ["rolelist", "rl", "roles"],
				guildOnly: true,
				throttling: {
					usages: 1,
					duration: 60
				},
			});
		}

		run(msg: CommandoMessage) {
			return msg.channel.send(`Roles:\n${tokens.roleIDs.assignable.map(role => ` - ${role.aliases.join(", ")}`).join("\n")}`);
		}
	},
	class WhoHasRoleCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "who-has",
				aliases: ["whohasrole", "whr", "whohas", "wh", "who", "w"],
				group: "public",
				memberName: "who-has",
				description: "Lists of (at most 10) users who have the specified role.",
				examples: ["whohas <role>", "wh <role>", "w <role>"],
				guildOnly: true,

				args: [
					{
						key: "role",
						prompt: "What role do you want to search for?",
						type: "string"
					}
				]
			});
		}

		run(msg: CommandoMessage, args: RoleArgument) {
			const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles.cache);
			if (roleInf !== undefined) {
				const { role } = roleInf;
				const members = shuffle(Array.from(role.members.values())).filter((_, index) => index < 10);
				return msg.channel.send(`Here is ${members.length} (of ${role.members.size}) users with the ${role.name} role:\n${members.map(member => ` - ${member.user.username}#${member.user.discriminator}`).join("\n")}`);
			}
		}
	}
];