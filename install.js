import { existsSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";

const databasePath = "database.sqlite3";
if (!existsSync(databasePath)) {
	writeFileSync(databasePath, "");
}

const tokensPath = join("src", "tokens.json");
if (!existsSync(tokensPath)) {
	copyFileSync(join("src", "tokens.template.json"), tokensPath);
}