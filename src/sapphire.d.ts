import { DB } from "./db.js";

declare module "@sapphire/pieces" {
	interface Container {
		db: DB;
		ownerID: string,
	}
}