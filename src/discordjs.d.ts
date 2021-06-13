type Awaited<T> = T | Promise<T>;

declare module "discord.js" {
	interface Client extends BaseClient {
		on<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => Awaited<void>): this;
	}
}