import {
	SlashCommandBuilder,
	EmbedBuilder,
	ChatInputCommandInteraction,
	MessageFlags
} from "discord.js";
import { createSafeEmbed, safeTruncate } from "../utils/embedHelper.js";
import { database } from "../index.js";

interface LogEntry {
	action: "add" | "modify" | "delete";
	timestamp: number;
	username: string;
	details: {
		trigger: string;
		replies?: string[];
		type?: string;
		mode?: string;
		probability?: number;
	};
}

const CONSTANTS = {
	SUCCESS_COLOR: "#A1DD70",
	ERROR_COLOR: "#EE4E4E",
	ERROR_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif",
	ACTION_EMOJIS: {
		add: "📝", // Writing emoji for add
		delete: "🗑️", // Trash bin for delete
		modify: "✏️" // Pencil for modify
	},
	ITEMS_PER_PAGE: 4 // 减少每页项目数量以避免字段限制
};

// Helper function to format timestamp
function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleString("zh-TW", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}

// Helper function to format log entry
function formatLogEntry(log: LogEntry) {
	const emoji = CONSTANTS.ACTION_EMOJIS[log.action];
	let content = "";

	switch (log.action) {
		case "add":
			content = [
				`${emoji} **新增觸發詞:** \`${safeTruncate(log.details.trigger, 50)}\``,
				`└ 回覆: ${log.details.replies?.map(r => `\`${safeTruncate(r, 30)}\``).join(", ") || "無"}`,
				`└ 類型: \`${log.details.type || "無"}\``,
				`└ 模式: \`${log.details.mode || "無"}\``,
				`└ 機率: \`${log.details.probability || 100}%\``
			].join("\n");
			break;

		case "modify":
			content = [
				`${emoji} **修改觸發詞:** \`${safeTruncate(log.details.trigger, 50)}\``,
				`└ 新回覆: ${log.details.replies?.map(r => `\`${safeTruncate(r, 30)}\``).join(", ") || "無"}`,
				`└ 新類型: \`${log.details.type || "無"}\``,
				`└ 新模式: \`${log.details.mode || "無"}\``,
				`└ 新機率: \`${log.details.probability || 100}%\``
			].join("\n");
			break;

		case "delete":
			content = `${emoji} **刪除觸發詞:** \`${safeTruncate(log.details.trigger, 50)}\``;
			break;
	}

	return {
		name: `${formatTimestamp(log.timestamp)} • ${safeTruncate(log.username, 20)}`,
		value: content,
		inline: false
	};
}

function createErrorEmbed(message: string): EmbedBuilder {
	return createSafeEmbed({
		title: "❌ 錯誤",
		description: message,
		color: CONSTANTS.ERROR_COLOR,
		thumbnail: CONSTANTS.ERROR_THUMBNAIL
	});
}

export default {
	data: new SlashCommandBuilder()
		.setName("logs")
		.setDescription("View server action logs")
		.setNameLocalizations({
			"zh-TW": "日誌"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看伺服器的動作日誌"
		})
		.addBooleanOption(option =>
			option
				.setName("visible")
				.setNameLocalizations({
					"zh-TW": "其他人可見"
				})
				.setDescription("設定是否讓其他人看到此訊息")
				.setDescriptionLocalizations({
					"zh-TW": "設定是否讓其他人看到此訊息"
				})
				.setRequired(false)
		)
		.addIntegerOption(option =>
			option
				.setName("page")
				.setNameLocalizations({
					"zh-TW": "頁數"
				})
				.setDescription("指定要查看的頁數")
				.setDescriptionLocalizations({
					"zh-TW": "指定要查看的頁數"
				})
				.setRequired(false)
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		...args: string[]
	): Promise<void> {
		try {
			const logs =
				((await database.get(
					`${interaction.guild?.id}.logs`
				)) as LogEntry[]) || [];
			const isVisible =
				interaction.options.getBoolean("visible") ?? false;

			if (!logs || logs.length === 0) {
				await interaction.reply({
					embeds: [
						createSafeEmbed({
							title: "📋 執行紀錄",
							description: "目前沒有任何紀錄",
							color: CONSTANTS.SUCCESS_COLOR
						})
					],
					flags: isVisible ? MessageFlags.Ephemeral : undefined
				});
				return;
			}

			const maxPages = Math.ceil(logs.length / CONSTANTS.ITEMS_PER_PAGE);
			const page = Math.min(
				Math.max(interaction.options.getInteger("page") || 1, 1),
				maxPages
			);

			const startIdx = (page - 1) * CONSTANTS.ITEMS_PER_PAGE;
			const pageItems = logs.slice(
				startIdx,
				startIdx + CONSTANTS.ITEMS_PER_PAGE
			);

			const embed = createSafeEmbed({
				title: "📋 機器人執行紀錄",
				color: CONSTANTS.SUCCESS_COLOR,
				fields: pageItems.map(formatLogEntry),
				footer: `第 ${page}/${maxPages} 頁 • 共 ${logs.length} 筆紀錄`,
				timestamp: new Date()
			});

			await interaction.reply({
				embeds: [embed],
				flags: isVisible ? MessageFlags.Ephemeral : undefined
			});
		} catch (error) {
			console.error("Error displaying logs:", error);
			await interaction.reply({
				embeds: [createErrorEmbed("顯示紀錄時發生錯誤")],
				flags: MessageFlags.Ephemeral
			});
		}
	}
};
