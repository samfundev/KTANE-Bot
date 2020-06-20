import { Command, CommandoClient, CommandoMessage, CommandoGuild, SettingProvider } from "discord.js-commando"

class Settings extends SettingProvider {
	guild: CommandoGuild;
	provider: SettingProvider;

	constructor(msg: CommandoMessage) {
		super();
		this.guild = msg.guild;
		this.provider = msg.client.provider;
	}

	get(key: string, def?: any) {
		return this.provider.get(this.guild, key, def || null);
	}

	set(key: string, val: any) {
		return this.provider.set(this.guild, key, val);
	}

	remove(key: string) {
		return this.provider.remove(this.guild, key);
	}

	clear() {
		return this.provider.clear(this.guild);
	}
}

interface NameArgument {
	name: string;
}

module.exports = [
	class AddProfileCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "add-profile",
				aliases: ["addprofile", "profileadd"],
				group: "public",
				memberName: "add-profile",
				description: "Allows you to add Mod Selector profiles.",
				examples: ["profileadd [name]", "addprofile [name]"],
				guildOnly: true,

				args: [
					{
						key: "name",
						prompt: "Please give a name to the profile.",
						type: "string",
						default: ""
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return this.client.isOwner(msg.author);
		}

		run(msg: CommandoMessage, args: NameArgument) {
			if (msg.attachments.size == 1) {
				var settings = new Settings(msg);
				var profiles;
				var url = msg.attachments.first()?.url;
				if (args.name === "") {
					profiles = settings.get("user-profiles", {});
					var exists = (msg.member.id in profiles);

					profiles[msg.member.id] = url;
					settings.set("user-profiles", profiles);

					if (exists) {
						return msg.reply("User profile updated successfully!");
					} else {
						return msg.reply("New user profile created successfully!");
					}
				} else {
					var name = args.name;
					profiles = settings.get("name-profiles", {});
					if (name in profiles) {
						if (profiles[name].id == msg.member.id) {
							profiles[name].url = url;
							settings.set("name-profiles", profiles);
							return msg.reply("Profile updated successfully!");
						} else {
							msg.client.users.fetch(profiles[name].id).then((user) => 
								msg.reply("Sorry, that profile name already taken by " + user.username + ".")
							).catch(() => 
								msg.reply("Sorry, that profile name is already taken.")
							);
						}
					} else {
						profiles[name] = {
							url: url,
							id: msg.member.id
						};
						settings.set("name-profiles", profiles);
						return msg.reply("New profile created successfully!");
					}
				}
			} else if (msg.attachments.size == 0) {
				return msg.reply("Please attach the profile with your message.");
			} else {
				return msg.reply("Please only attach one profile.");
			}

			return null;
		}
	},
	class GetProfile extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "get-profile",
				aliases: ["getprofile", "profileget"],
				group: "public",
				memberName: "get-profile",
				description: "Allows you to get Mod Selector profiles.",
				examples: ["profileget [name]", "getprofile [name]"],
				guildOnly: true,

				args: [
					{
						key: "name",
						prompt: "Please give a name to the profile.",
						type: "string",
						default: ""
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return this.client.isOwner(msg.author);
		}

		run(msg: CommandoMessage, args: NameArgument) {
			if (msg.attachments.size == 1) {
				var settings = new Settings(msg);
				var profiles;
				var url = msg.attachments.first()?.url;
				if (args.name === "") {
					profiles = settings.get("user-profiles", {});
					var exists = (msg.member.id in profiles);

					profiles[msg.member.id] = url;
					settings.set("user-profiles", profiles);

					if (exists) {
						return msg.reply("User profile updated successfully!");
					} else {
						return msg.reply("New user profile created successfully!");
					}
				} else {
					var name = args.name;
					profiles = settings.get("name-profiles", {});
					if (name in profiles) {
						if (profiles[name].id == msg.member.id) {
							profiles[name].url = url;
							settings.set("name-profiles", profiles);
							return msg.reply("Profile updated successfully!");
						} else {
							msg.client.users.fetch(profiles[name].id).then((user) => 
								msg.reply("Sorry, that profile name already taken by " + user.username + ".")
							).catch(() => 
								msg.reply("Sorry, that profile name is already taken.")
							);
						}
					} else {
						profiles[name] = {
							url: url,
							id: msg.member.id
						};
						settings.set("name-profiles", profiles);
						return msg.reply("New profile created successfully!");
					}
				}
			} else if (msg.attachments.size == 0) {
				return msg.reply("Please attach the profile with your message.");
			} else {
				return msg.reply("Please only attach one profile.");
			}

			return null;
		}
	}
];