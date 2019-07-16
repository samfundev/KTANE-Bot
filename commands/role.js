const commando = require("discord.js-commando");
const tokens = require("./../tokens");
const logger = require("./../log");

function getRole(roleName, assignableData, guildRoles) {
	let targetRole = roleName.toLowerCase();
	for (let roleData of assignableData) {
		if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
			const role = guildRoles.get(roleData.roleID);
			if (role == undefined) {
				logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
				return;
			}

			return [ role, roleData ];
		}
	}
}

function shuffle(a) {
	var j, x, i;
	for (i = a.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		x = a[i];
		a[i] = a[j];
		a[j] = x;
	}
	return a;
}

module.exports = [
	class RoleCommand extends commando.Command {
		constructor(client) {
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

		run(msg, args) {
			const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles);
			if (roleInf !== undefined) {
				const role = roleInf[0], roleData = roleInf[1];
				if (roleData.prereq && !roleData.prereq.some(pre => msg.member.roles.has(pre))) {
					msg.channel.send(`You can’t self-assign the "${role.name}" role because you don’t have any of its prerequisite roles.`);
					return;
				}
				if (msg.member.roles.has(role.id)) {
					msg.member.removeRole(role)
						.then(() => msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`))
						.catch(logger.error);
				} else {
					msg.member.addRole(role)
						.then(() => msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`))
						.catch(logger.error);
				}
			}
		}
	},
	class RoleListCommand extends commando.Command {
		constructor(client) {
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

		run(msg) {
			msg.channel.send(`Roles:\n${tokens.roleIDs.assignable.map(role => ` - ${role.aliases.join(", ")}`).join("\n")}`);
		}
	},
	class WhoHasRoleCommand extends commando.Command {
		constructor(client) {
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

		run(msg, args) {
			const roleInf = getRole(args.role, tokens.roleIDs.assignable, msg.guild.roles);
			if (roleInf !== undefined) {
				const role = roleInf[0];
				const members = shuffle(Array.from(role.members.values())).filter((_, index) => index < 10);
				msg.channel.send(`Here is ${members.length} (of ${role.members.size}) users with the ${role.name} role:\n${members.map(member => ` - ${member.user.username}#${member.user.discriminator}`).join("\n")}`);
			}
		}
	}
];