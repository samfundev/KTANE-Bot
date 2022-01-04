import { DB } from "./db";

declare module "@sapphire/framework" {
	interface Command {
		usage: string;
	}
}

declare module "@sapphire/pieces" {
	interface Container {
		db: DB;
		ownerID: "76052829285916672",
	}
}