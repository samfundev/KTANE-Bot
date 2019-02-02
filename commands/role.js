const commando = require("discord.js-commando");
const tokens = require("./../tokens");
const logger = require("./../log");

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
			const targetRole = args.role.toLowerCase();
			for (let roleData of tokens.roleIDs.assignable) {
				if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
					const role = msg.guild.roles.get(roleData.roleID);
					if (role == undefined) {
						logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
						return;
					}

					if (msg.member.roles.has(roleData.roleID)) {
						msg.member.removeRole(role)
							.then(() => msg.channel.send(`Removed the "${role.name}" role from ${msg.author.username}.`))
							.catch(logger.error);
					} else {
						msg.member.addRole(role)
							.then(() => msg.channel.send(`Gave the "${role.name}" role to ${msg.author.username}.`))
							.catch(logger.error);
					}

					break;
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
				description: "DMs you a list of all the roles that can be used with the role command.",
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
	}
];