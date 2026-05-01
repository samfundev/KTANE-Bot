import { join } from "path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { VideoChannel } from "./video";
import { ScheduledTask } from "./task-manager";
import { VoteData } from "#utils/voting";
import { Player } from "./lfg";
import Logger from "./log";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const database = new Database(join(__dirname, "..", "database.sqlite3"));
const { rdr, wtr } = createDatabaseClient<{
	settings: {
		languages: Record<string, string[]>;
		RequestsChannel?: string;
		AuditLog?: string;
		lastWorkshopScan?: number;
		videoChannels?: VideoChannel[];
		videosAnnounced?: string[];
		scheduledTasks?: ScheduledTask[];
		vote?: VoteData;
		reportMessages?: Record<string, string>;
		lfg_players?: Player[];
	};
	author_lookup: string;
	workshop_mods: number;
}>(
	database,
	{
		settings: {
			languages: {},
		},
		author_lookup: "",
		workshop_mods: 0,
	},
	{ jsonTables: ["settings"] },
);

export const settings = { write: wtr.settings, read: rdr.settings };
export const author_lookup = {
	write: wtr.author_lookup,
	read: rdr.author_lookup,
};
export const workshop_mods = {
	write: wtr.workshop_mods,
	read: rdr.workshop_mods,
};

// From https://gist.github.com/vedantroy/df6b18fa89bc24acfe89fc8493743378

////////////////////////////////////////
// 1. Types
////////////////////////////////////////
export type SchemaDefinition = Record<string, unknown>;

export interface CreateDBOptions {
	idColumn?: string;
	jsonColumn?: string;
	debugSql?: boolean;
	jsonTables?: string[];
}

////////////////////////////////////////
// 2. The shape of what we return
////////////////////////////////////////
export interface DBClient<TSchema extends SchemaDefinition> {
	/** Reader: returns plain JS objects, no Proxy. */
	rdr: { [TableName in keyof TSchema]: TableReader<TSchema[TableName]> };
	/** Writer: partial updates (Proxies). */
	wtr: { [TableName in keyof TSchema]: TableWriter<TSchema[TableName]> };
}

/** Reader interface: bracket-get returns plain objects from memory. */
export type TableReader<TRow> = {
	[rowId: string]: TRow | undefined;
} & {
	global: TRow;
	forEach(callback: (id: string, rowData: TRow) => void): void;
	keys(): string[];
	values(): TRow[];
	entries(): Array<[string, TRow]>;
	dict(): Record<string, TRow>;
	has(id: string): boolean;
};

/** Writer interface: bracket-get returns a nested Proxy for partial JSON updates. */
export type TableWriter<TRow> = {
	[rowId: string]: TRowProxy<TRow> | TRow;
} & {
	forEach(callback: (id: string, rowProxy: TRowProxy<TRow>) => void): void;
	keys(): string[];
	entries(): Array<[string, TRowProxy<TRow>]>;
	has(id: string): boolean;
};

/**
 * A nested Proxy that allows partial updates to single fields.
 * If you do `writer.users['bob'].nested.foo = 123`,
 * it calls `json_set(..., '$.nested.foo', 123)` in the DB.
 */
export type TRowProxy<TRow> = TRow & {
	[nestedKey: string]: unknown;
};

////////////////////////////////////////
// 3. Main entry point
////////////////////////////////////////
export function createDatabaseClient<TSchema extends SchemaDefinition>(
	db: Database.Database,
	schema: TSchema,
	options: CreateDBOptions = {},
): DBClient<TSchema> {
	const debugSql = !!options.debugSql;
	const jsonTables = options.jsonTables ?? [];

	////////////////////////////////////////
	// A) In-memory cache: Map<tableName, Map<rowId, object>>
	////////////////////////////////////////
	const memoryCache = new Map<string, Map<string, unknown>>();
	for (const tableName of Object.keys(schema)) {
		memoryCache.set(tableName, new Map());
	}

	////////////////////////////////////////
	// B) Precompiled statements for each table
	////////////////////////////////////////
	function wrapStmt(
		stmt: ReturnType<Database.Database["prepare"]>,
		label: string,
	) {
		const s = stmt as {
			get(...args: unknown[]): unknown;
			run(...args: unknown[]): Database.RunResult;
			all(...args: unknown[]): unknown[];
		};
		return {
			get(...args: unknown[]) {
				if (debugSql) {
					Logger.log(`[SQL GET] ${label}, params: ${JSON.stringify(args)}`);
				}
				return s.get(...args);
			},
			run(...args: unknown[]) {
				if (debugSql) {
					Logger.log(`[SQL RUN] ${label}, params: ${JSON.stringify(args)}`);
				}
				return s.run(...args);
			},
			all(...args: unknown[]) {
				if (debugSql) {
					Logger.log(`[SQL ALL] ${label}, params: ${JSON.stringify(args)}`);
				}
				return s.all(...args);
			},
		};
	}

	const stmts = new Map<
		string,
		{
			selectRow: ReturnType<typeof wrapStmt>;
			upsertWholeRow: ReturnType<typeof wrapStmt>;
			deleteRow: ReturnType<typeof wrapStmt>;
			jsonSet: ReturnType<typeof wrapStmt>;
			jsonRemove: ReturnType<typeof wrapStmt>;
			checkExistence: ReturnType<typeof wrapStmt>;
			selectAllIds: ReturnType<typeof wrapStmt>;
		}
	>();

	function getStatementsForTable(tableName: string) {
		if (stmts.has(tableName)) {
			return stmts.get(tableName)!;
		}

		// Get idColumn and jsonColumn for the table from introspection
		const tableInfo = db
			.prepare(`PRAGMA table_info(${tableName})`)
			.all() as Database.ColumnDefinition[];
		const [idColumn, jsonColumn] = tableInfo.map((x) => x.name);

		const selectRowSQL = `
      SELECT ${jsonColumn} AS jsonData
        FROM ${tableName}
       WHERE ${idColumn} = ?`;
		const upsertWholeRowSQL = `
      INSERT OR REPLACE INTO ${tableName} (${idColumn}, ${jsonColumn})
      VALUES (?, json(?))`;
		const deleteRowSQL = `
      DELETE FROM ${tableName}
       WHERE ${idColumn} = ?`;
		const jsonSetSQL = `
      UPDATE ${tableName}
         SET ${jsonColumn} = json_set(${jsonColumn}, ?, json(?))
       WHERE ${idColumn} = ?`;
		const jsonRemoveSQL = `
      UPDATE ${tableName}
         SET ${jsonColumn} = json_remove(${jsonColumn}, ?)
       WHERE ${idColumn} = ?`;
		const checkExistenceSQL = `
      SELECT 1 FROM ${tableName}
       WHERE ${idColumn} = ?`;
		const selectAllIdsSQL = `
      SELECT ${idColumn} AS id
        FROM ${tableName}`;

		const prepared = {
			selectRow: wrapStmt(db.prepare(selectRowSQL), `${tableName}:selectRow`),
			upsertWholeRow: wrapStmt(
				db.prepare(upsertWholeRowSQL),
				`${tableName}:upsertWholeRow`,
			),
			deleteRow: wrapStmt(db.prepare(deleteRowSQL), `${tableName}:deleteRow`),
			jsonSet: wrapStmt(db.prepare(jsonSetSQL), `${tableName}:jsonSet`),
			jsonRemove: wrapStmt(
				db.prepare(jsonRemoveSQL),
				`${tableName}:jsonRemove`,
			),
			checkExistence: wrapStmt(
				db.prepare(checkExistenceSQL),
				`${tableName}:checkExistence`,
			),
			selectAllIds: wrapStmt(
				db.prepare(selectAllIdsSQL),
				`${tableName}:selectAllIds`,
			),
		};
		stmts.set(tableName, prepared);
		return prepared;
	}

	////////////////////////////////////////
	// C) Helper: load a row's JSON into memory cache if not loaded
	////////////////////////////////////////
	function loadRow(tableName: string, rowId: string) {
		const cacheForTable = memoryCache.get(tableName)!;
		if (cacheForTable.has(rowId)) {
			return; // already in memory
		}
		const { selectRow } = getStatementsForTable(tableName);
		const row = selectRow.get(rowId) as { jsonData: string } | undefined;
		if (!row) return; // not found in DB
		if (!jsonTables.includes(tableName)) {
			cacheForTable.set(rowId, row.jsonData);
			return; // not a JSON table
		}
		try {
			cacheForTable.set(rowId, JSON.parse(row.jsonData));
		} catch {
			cacheForTable.set(rowId, null);
		}
	}

	////////////////////////////////////////
	// D) JSON path helpers for partial updates
	////////////////////////////////////////
	function pathToJsonPathString(path: string[]) {
		if (!path.length) return "$";
		return "$." + path.map(escapeJsonKey).join(".");
	}

	function escapeJsonKey(k: string): string {
		// naive
		return k.replace(/"/g, '\\"');
	}

	////////////////////////////////////////
	// E) Row-level Proxy for partial updates
	////////////////////////////////////////
	function createRowProxy(
		tableName: string,
		rowId: string,
		pathSoFar: string[] = [],
	): unknown {
		return new Proxy(
			{},
			{
				get(_, propKey) {
					if (typeof propKey === "symbol") {
						return Reflect.get(_, propKey) as unknown;
					}
					loadRow(tableName, rowId);

					const cacheForTable = memoryCache.get(tableName)!;
					if (!cacheForTable.has(rowId)) {
						throw new Error(
							`Row '${rowId}' not found in table '${tableName}' (read).`,
						);
					}
					const rowData = cacheForTable.get(rowId);

					const newPath = [...pathSoFar, propKey.toString()];
					let current = rowData as Record<string, unknown>;
					for (const p of newPath) {
						if (current == null || typeof current !== "object") {
							return undefined;
						}
						current = current[p] as Record<string, unknown>;
					}

					// If object or array, return deeper proxy so we can do partial updates
					if (current && typeof current === "object") {
						return createRowProxy(tableName, rowId, newPath);
					}
					return current;
				},

				set(_, propKey, value) {
					loadRow(tableName, rowId);
					const cacheForTable = memoryCache.get(tableName)!;
					if (!cacheForTable.has(rowId)) {
						throw new Error(
							`Row '${rowId}' not found in table '${tableName}' (write).`,
						);
					}

					const { jsonSet } = getStatementsForTable(tableName);
					const newPath = [...pathSoFar, propKey.toString()];
					const jsonPath = pathToJsonPathString(newPath);

					jsonSet.run(jsonPath, JSON.stringify(value), rowId);

					// Update local cache
					const rowData = cacheForTable.get(rowId);
					let cursor = rowData as Record<string, unknown>;
					for (let i = 0; i < newPath.length - 1; i++) {
						const seg = newPath[i];
						if (cursor[seg] == null || typeof cursor[seg] !== "object") {
							cursor[seg] = {};
						}
						cursor = cursor[seg] as Record<string, unknown>;
					}
					cursor[newPath[newPath.length - 1]] = value;
					return true;
				},

				deleteProperty(_, propKey) {
					loadRow(tableName, rowId);
					const cacheForTable = memoryCache.get(tableName)!;
					if (!cacheForTable.has(rowId)) {
						throw new Error(
							`Row '${rowId}' not found in table '${tableName}' (delete).`,
						);
					}

					// If it looks like a numeric index => forbid
					const keyString = propKey.toString();
					if (/^\d+$/.test(keyString)) {
						throw new Error(
							`Deleting array elements by index is not allowed: .${keyString}`,
						);
					}

					const { jsonRemove } = getStatementsForTable(tableName);
					const newPath = [...pathSoFar, keyString];
					const jsonPath = pathToJsonPathString(newPath);
					jsonRemove.run(jsonPath, rowId);

					// Update in-memory object
					const rowData = cacheForTable.get(rowId);
					let cursor = rowData as Record<string, unknown>;
					for (let i = 0; i < newPath.length - 1; i++) {
						const seg = newPath[i];
						if (cursor[seg] == null || typeof cursor[seg] !== "object") {
							return true;
						}
						cursor = cursor[seg] as Record<string, unknown>;
					}
					delete cursor[newPath[newPath.length - 1]];
					return true;
				},

				has(_, propKey) {
					if (typeof propKey === "symbol") {
						return Reflect.has(_, propKey);
					}
					loadRow(tableName, rowId);
					const cacheForTable = memoryCache.get(tableName)!;
					if (!cacheForTable.has(rowId)) {
						return false;
					}
					const rowData = cacheForTable.get(rowId);

					let current: unknown = rowData;
					for (const p of pathSoFar) {
						if (current == null || typeof current !== "object") {
							return false;
						}
						current = (current as Record<string, unknown>)[p];
					}

					if (current && typeof current === "object") {
						return Object.prototype.hasOwnProperty.call(current, propKey);
					}
					return false;
				},
			},
		);
	}

	////////////////////////////////////////
	// F) Create the "Reader" table object
	////////////////////////////////////////
	function createTableReader(tableName: string): TableReader<unknown> {
		const { selectAllIds, checkExistence } = getStatementsForTable(tableName);
		const cacheForTable = memoryCache.get(tableName)!;

		const readerImplementation = {
			forEach(callback: (id: string, data: unknown) => void) {
				const rows = selectAllIds.all() as Array<{ id: string }>;
				for (const r of rows) {
					loadRow(tableName, r.id);
					const cached = cacheForTable.get(r.id);
					if (cached !== undefined) {
						callback(r.id, cached);
					}
				}
			},
			keys(): string[] {
				return (selectAllIds.all() as Array<{ id: string }>).map((r) => r.id);
			},
			values(): unknown[] {
				return (selectAllIds.all() as Array<{ id: string }>).map((r) => {
					loadRow(tableName, r.id);
					return cacheForTable.get(r.id);
				});
			},
			dict(): Record<string, unknown> {
				return (selectAllIds.all() as Array<{ id: string }>).reduce<
					Record<string, unknown>
				>((acc, r) => {
					loadRow(tableName, r.id);
					acc[r.id] = cacheForTable.get(r.id);
					return acc;
				}, {});
			},
			entries(): Array<[string, unknown]> {
				return (selectAllIds.all() as Array<{ id: string }>).map((r) => {
					loadRow(tableName, r.id);
					return [r.id, cacheForTable.get(r.id)] as [string, unknown];
				});
			},
			has(id: string) {
				if (cacheForTable.has(id)) return true;
				const row = checkExistence.get(id);
				return !!row;
			},
		};

		return new Proxy(readerImplementation, {
			get(target, propKey, receiver) {
				if (typeof propKey === "symbol") {
					return Reflect.get(target, propKey, receiver) as unknown;
				}
				if (Reflect.has(target, propKey)) {
					return Reflect.get(target, propKey, receiver) as unknown;
				}
				// otherwise treat propKey as rowId
				const rowId = propKey.toString();
				loadRow(tableName, rowId);
				return cacheForTable.get(rowId);
			},
			set() {
				throw new Error(`Cannot write via Reader API`);
			},
			deleteProperty() {
				throw new Error(`Cannot delete via Reader API`);
			},
			has(target, propKey) {
				if (typeof propKey === "symbol") {
					return Reflect.has(target, propKey);
				}
				if (Reflect.has(target, propKey)) {
					return true;
				}
				const rowId = propKey.toString();
				if (cacheForTable.has(rowId)) {
					return true;
				}
				const row = checkExistence.get(rowId);
				return !!row;
			},
		}) as TableReader<unknown>;
	}

	////////////////////////////////////////
	// G) Create the "Writer" table object
	////////////////////////////////////////
	function createTableWriter(tableName: string): TableWriter<unknown> {
		const { checkExistence, selectAllIds, upsertWholeRow, deleteRow } =
			getStatementsForTable(tableName);
		const cacheForTable = memoryCache.get(tableName)!;

		const writerImplementation = {
			forEach(callback: (id: string, rowProxy: unknown) => void) {
				const rows = selectAllIds.all() as Array<{ id: string }>;
				for (const r of rows) {
					loadRow(tableName, r.id);
					callback(r.id, createRowProxy(tableName, r.id));
				}
			},
			keys(): string[] {
				return (selectAllIds.all() as Array<{ id: string }>).map((r) => r.id);
			},
			entries(): Array<[string, unknown]> {
				return (selectAllIds.all() as Array<{ id: string }>).map((r) => {
					loadRow(tableName, r.id);
					return [r.id, createRowProxy(tableName, r.id)] as [string, unknown];
				});
			},
			has(id: string) {
				if (cacheForTable.has(id)) return true;
				const row = checkExistence.get(id);
				return !!row;
			},
		};

		return new Proxy(writerImplementation, {
			get(target, propKey, receiver) {
				if (typeof propKey === "symbol") {
					return Reflect.get(target, propKey, receiver) as unknown;
				}
				if (Reflect.has(target, propKey)) {
					return Reflect.get(target, propKey, receiver) as unknown;
				}
				const rowId = propKey.toString();
				loadRow(tableName, rowId);
				return createRowProxy(tableName, rowId);
			},
			set(_, rowId, value) {
				// upsert entire row
				const idString = rowId.toString();
				cacheForTable.set(idString, value);
				upsertWholeRow.run(
					idString,
					jsonTables.includes(tableName) ? JSON.stringify(value) : value,
				);
				return true;
			},
			deleteProperty(_, rowId) {
				const idString = rowId.toString();
				cacheForTable.delete(idString);
				deleteRow.run(idString);
				return true;
			},
			has(target, propKey) {
				if (typeof propKey === "symbol") {
					return Reflect.has(target, propKey);
				}
				if (Reflect.has(target, propKey)) {
					return true;
				}
				const rowId = propKey.toString();
				if (cacheForTable.has(rowId)) {
					return true;
				}
				const row = checkExistence.get(rowId);
				return !!row;
			},
		}) as TableWriter<unknown>;
	}

	////////////////////////////////////////
	// H) Build the overall "rdr" and "wtr" objects
	////////////////////////////////////////
	const rdrObj = {} as DBClient<TSchema>["rdr"];
	const wtrObj = {} as DBClient<TSchema>["wtr"];

	for (const tableName of Object.keys(schema)) {
		Object.defineProperty(rdrObj, tableName, {
			value: createTableReader(tableName),
			enumerable: true,
			configurable: false,
			writable: false,
		});
		Object.defineProperty(wtrObj, tableName, {
			value: createTableWriter(tableName),
			enumerable: true,
			configurable: false,
			writable: false,
		});
	}

	return {
		rdr: rdrObj,
		wtr: wtrObj,
	};
}
