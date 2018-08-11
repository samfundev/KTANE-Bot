const commando = require("discord.js-commando");

class Settings {
	constructor(msg) {
		this.guild = msg.guild;
		this.provider = msg.client.provider;
	}

	get(key, def) {
		return this.provider.get(this.guild, key, def || null);
	}

	set(key, val) {
		return this.provider.set(this.guild, key, val);
	}

	remove(key) {
		return this.provider.remove(this.guild, key);
	}

	clear() {
		return this.provider.remove(this.guild);
	}
}

module.exports = [
	class AddProfileCommand extends commando.Command {
		constructor(client) {
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
						default: false
					}
				]
			});
		}

		hasPermission(msg) {
			return this.client.isOwner(msg.author);
		}

		run(msg, args) {
			if (msg.attachments.size == 1) {
				var settings = new Settings(msg);
				var profiles;
				var url = msg.attachments.first().url;
				if (args.name == false) {
					profiles = settings.get("user-profiles", {});
					var exists = (msg.member.id in profiles);

					profiles[msg.member.id] = url;
					settings.set("user-profiles", profiles);

					if (exists) {
						msg.reply("User profile updated successfully!");
					} else {
						msg.reply("New user profile created successfully!");
					}
				} else {
					var name = args.name;
					profiles = settings.get("name-profiles", {});
					if (name in profiles) {
						if (profiles[name].id == msg.member.id) {
							profiles[name].url = url;
							settings.set("name-profiles", profiles);
							msg.reply("Profile updated successfully!");
						} else {
							msg.client.fetchUser(profiles[name].id).then((user) => {
								msg.reply("Sorry, that profile name already taken by " + user.username + ".");
							}).catch(() => {
								msg.reply("Sorry, that profile name is already taken.");
							});
						}
					} else {
						profiles[name] = {
							url: url,
							id: msg.member.id
						};
						settings.set("name-profiles", profiles);
						msg.reply("New profile created successfully!");
					}
				}
			} else if (msg.attachments.size == 0) {
				msg.reply("Please attach the profile with your message.");
			} else {
				msg.reply("Please only attach one profile.");
			}
		}
	},
	class GetProfile extends commando.Command {
		constructor(client) {
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
						default: false
					}
				]
			});
		}

		hasPermission(msg) {
			return this.client.isOwner(msg.author);
		}

		run(msg, args) {
			if (msg.attachments.size == 1) {
				var settings = new Settings(msg);
				var profiles;
				var url = msg.attachments.first().url;
				if (args.name == false) {
					profiles = settings.get("user-profiles", {});
					var exists = (msg.member.id in profiles);

					profiles[msg.member.id] = url;
					settings.set("user-profiles", profiles);

					if (exists) {
						msg.reply("User profile updated successfully!");
					} else {
						msg.reply("New user profile created successfully!");
					}
				} else {
					var name = args.name;
					profiles = settings.get("name-profiles", {});
					if (name in profiles) {
						if (profiles[name].id == msg.member.id) {
							profiles[name].url = url;
							settings.set("name-profiles", profiles);
							msg.reply("Profile updated successfully!");
						} else {
							msg.client.fetchUser(profiles[name].id).then((user) => {
								msg.reply("Sorry, that profile name already taken by " + user.username + ".");
							}).catch(() => {
								msg.reply("Sorry, that profile name is already taken.");
							});
						}
					} else {
						profiles[name] = {
							url: url,
							id: msg.member.id
						};
						settings.set("name-profiles", profiles);
						msg.reply("New profile created successfully!");
					}
				}
			} else if (msg.attachments.size == 0) {
				msg.reply("Please attach the profile with your message.");
			} else {
				msg.reply("Please only attach one profile.");
			}
		}
	}
];