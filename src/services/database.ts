import { Logger } from "./logger.js";
import cacheService from "./cache.js";
import { database } from "../index.js";

interface LogData {
	timestamp: number;
	id: string;
	[key: string]: any;
}

interface OutoConfig {
	maxLogsPerGuild: number;
	logRetentionDays: number;
	autoCleanupInterval: number;
}

interface LogsStructure {
	version: string;
	created: number;
	guilds: Record<string, any>;
}

interface EmojiCache {
	version: string;
	created: number;
	cache: Record<
		string,
		{
			data: any;
			timestamp: number;
		}
	>;
}

interface PaginatedLogs {
	logs: LogData[];
	total: number;
	limit: number;
	offset: number;
}

interface DatabaseStats {
	totalLogs: number;
	totalGuilds: number;
	emojiCacheSize: number;
	cacheSize: number;
}

class DatabaseService {
	private db: typeof database | null;
	private logger: Logger;
	private outoConfig: OutoConfig;

	constructor() {
		this.db = null;
		this.logger = new Logger("資料庫");
		this.outoConfig = {
			maxLogsPerGuild: 10,
			logRetentionDays: 30,
			autoCleanupInterval: 3600000
		};
	}

	async init(): Promise<void> {
		try {
			this.db = database;

			// 初始化資料庫結構
			await this.initializeDatabase();

			this.logger.success("Outo資料庫服務已初始化");
		} catch (error) {
			this.logger.error(`資料庫初始化失敗: ${(error as Error).message}`);
			throw error;
		}
	}

	async initializeDatabase(): Promise<void> {
		// 建立日誌表結構
		const logsStructure = (await this.db!.get(
			"logs_structure"
		)) as LogsStructure;
		if (!logsStructure) {
			await this.db!.set("logs_structure", {
				version: "1.0",
				created: Date.now(),
				guilds: {}
			});
		}

		// 建立emoji快取結構
		const emojiCache = (await this.db!.get("emoji_cache")) as EmojiCache;
		if (!emojiCache) {
			await this.db!.set("emoji_cache", {
				version: "1.0",
				created: Date.now(),
				cache: {}
			});
		}
	}

	getDB(): typeof database | null {
		return this.db;
	}

	// Outo特定的日誌管理方法
	async addLog(
		guildId: string,
		logData: Omit<LogData, "timestamp" | "id">
	): Promise<string | null> {
		try {
			const logs =
				((await this.db!.get(`logs_${guildId}`)) as LogData[]) || [];

			// 新增時間戳
			const fullLogData: LogData = {
				...logData,
				timestamp: Date.now(),
				id: this.generateLogId()
			};

			logs.push(fullLogData);

			// 限制日誌數量
			if (logs.length > this.outoConfig.maxLogsPerGuild) {
				logs.splice(0, logs.length - this.outoConfig.maxLogsPerGuild);
			}

			await this.db!.set(`logs_${guildId}`, logs);

			// 快取最新的日誌
			cacheService.set(`logs_${guildId}_latest`, logs.slice(-5), 300000); // 5分鐘快取

			return fullLogData.id;
		} catch (error) {
			this.logger.error(
				`新增日誌失敗 (Guild: ${guildId}): ${(error as Error).message}`
			);
			return null;
		}
	}

	async getLogs(
		guildId: string,
		limit: number = 10,
		offset: number = 0
	): Promise<PaginatedLogs> {
		try {
			const cacheKey = `logs_${guildId}_${limit}_${offset}`;
			const cached = cacheService.get(cacheKey);
			if (cached !== null) {
				return cached as PaginatedLogs;
			}

			const logs =
				((await this.db!.get(`logs_${guildId}`)) as LogData[]) || [];
			const paginatedLogs = logs.slice(offset, offset + limit);

			const result: PaginatedLogs = {
				logs: paginatedLogs,
				total: logs.length,
				limit,
				offset
			};

			// 快取結果（短期快取）
			cacheService.set(cacheKey, result, 60000); // 1分鐘快取

			return result;
		} catch (error) {
			this.logger.error(
				`取得日誌失敗 (Guild: ${guildId}): ${(error as Error).message}`
			);
			return { logs: [], total: 0, limit, offset };
		}
	}

	async removeLog(guildId: string, logId: string): Promise<boolean> {
		try {
			const logs =
				((await this.db!.get(`logs_${guildId}`)) as LogData[]) || [];
			const filteredLogs = logs.filter(log => log.id !== logId);

			await this.db!.set(`logs_${guildId}`, filteredLogs);

			// 清除相關快取
			cacheService.delete(`logs_${guildId}_latest`);

			return true;
		} catch (error) {
			this.logger.error(
				`刪除日誌失敗 (Guild: ${guildId}, Log: ${logId}): ${(error as Error).message}`
			);
			return false;
		}
	}

	async clearLogs(guildId: string): Promise<boolean> {
		try {
			await this.db!.delete(`logs_${guildId}`);

			// 清除相關快取
			cacheService.delete(`logs_${guildId}_latest`);

			return true;
		} catch (error) {
			this.logger.error(
				`清空日誌失敗 (Guild: ${guildId}): ${(error as Error).message}`
			);
			return false;
		}
	}

	// Emoji快取管理
	async cacheEmoji(guildId: string, emojiData: any): Promise<boolean> {
		try {
			const emojiCache = ((await this.db!.get(
				"emoji_cache"
			)) as EmojiCache) || {
				cache: {}
			};
			emojiCache.cache[guildId] = {
				data: emojiData,
				timestamp: Date.now()
			};

			await this.db!.set("emoji_cache", emojiCache);

			return true;
		} catch (error) {
			this.logger.error(
				`快取Emoji失敗 (Guild: ${guildId}): ${(error as Error).message}`
			);
			return false;
		}
	}

	async getCachedEmoji(guildId: string): Promise<any | null> {
		try {
			const emojiCache = (await this.db!.get(
				"emoji_cache"
			)) as EmojiCache;
			if (!emojiCache || !emojiCache.cache[guildId]) {
				return null;
			}

			const cached = emojiCache.cache[guildId];
			const now = Date.now();

			// 檢查是否過期（24小時）
			if (now - cached.timestamp > 86400000) {
				delete emojiCache.cache[guildId];
				await this.db!.set("emoji_cache", emojiCache);
				return null;
			}

			return cached.data;
		} catch (error) {
			this.logger.error(
				`取得快取的Emoji失敗 (Guild: ${guildId}): ${(error as Error).message}`
			);
			return null;
		}
	}

	// 產生日誌ID
	generateLogId(): string {
		return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// 取得資料庫統計
	async getStats(): Promise<DatabaseStats> {
		try {
			const logsStructure = (await this.db!.get(
				"logs_structure"
			)) as LogsStructure;
			const emojiCache = (await this.db!.get(
				"emoji_cache"
			)) as EmojiCache;

			let totalLogs = 0;
			let totalGuilds = 0;

			if (logsStructure && logsStructure.guilds) {
				totalGuilds = Object.keys(logsStructure.guilds).length;

				for (const guildId in logsStructure.guilds) {
					const logs =
						((await this.db!.get(
							`logs_${guildId}`
						)) as LogData[]) || [];
					totalLogs += logs.length;
				}
			}

			return {
				totalLogs,
				totalGuilds,
				emojiCacheSize: emojiCache
					? Object.keys(emojiCache.cache).length
					: 0,
				cacheSize: cacheService.getSize()
			};
		} catch (error) {
			this.logger.error(
				`取得資料庫統計失敗: ${(error as Error).message}`
			);
			return {
				totalLogs: 0,
				totalGuilds: 0,
				emojiCacheSize: 0,
				cacheSize: 0
			};
		}
	}

	// 關閉資料庫連線
	async close(): Promise<void> {
		try {
			if (this.db) {
				// QuickDB doesn't have a close method, so we just set it to null
				this.db = null;
				this.logger.info("資料庫連線已關閉");
			}
		} catch (error) {
			this.logger.error(
				`關閉資料庫連線失敗: ${(error as Error).message}`
			);
		}
	}
}

export default new DatabaseService();
