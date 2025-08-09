import moment from "moment";
import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	Interaction
} from "discord.js";
import emoji from "../assets/emoji.json" with { type: "json" };
import {
	createSafeEmbed,
	EMBED_LIMITS,
	safeTruncate
} from "../utils/embedHelper.js";

interface GuildEntry {
	trigger: string;
	replies: string[];
	type: string;
	mode: string;
	probability?: number;
}

interface ProcessedEntry {
	trigger: string;
	reply: string;
	type: string;
	mode: string;
}

interface ListData {
	totalPages: ProcessedEntry[][];
}

// Constants
const CONSTANTS = {
	CHUNK_SIZE: 6, // 减少每页项目数量以避免字段限制
	MAX_TRIGGER_LENGTH: 200,
	MAX_REPLY_LENGTH: 800, // 减少回复长度以避免字段值限制
	EMBED_COLOR: "#A4D0A4",
	DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
	REPLY_SEPARATOR: " ⋄ " // Using a diamond separator
};

// Cache for expensive computations
const listCache = new Collection<string, ListData>();

/**
 * Truncate text with ellipsis if needed
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text: string, maxLength: number): string {
	return safeTruncate(text, maxLength);
}

/**
 * Create a cache key for list data
 * @param {GuildEntry[]} guilddb - Guild database
 * @returns {string} Cache key
 */
function createCacheKey(guilddb: GuildEntry[]): string {
	return `${guilddb.length}-${JSON.stringify(guilddb[0])}`;
}

/**
 * Process guild database entries into displayable format
 * @param {GuildEntry[]} guilddb - Guild database
 * @returns {ProcessedEntry[]} Processed data
 */
function processGuildData(guilddb: GuildEntry[]): ProcessedEntry[] {
	return guilddb.map((entry, i) => {
		const { trigger, replies, type, mode, probability = 100 } = entry;

		// Calculate available space for replies accounting for separator
		const separatorSpace =
			CONSTANTS.REPLY_SEPARATOR.length * (replies.length - 1);
		const maxReplyLength = Math.floor(
			(CONSTANTS.MAX_REPLY_LENGTH - separatorSpace) / replies.length
		);

		// Format trigger with probability if not 100%
		const triggerText =
			probability !== 100
				? `${emoji.dot} **${truncateText(trigger, CONSTANTS.MAX_TRIGGER_LENGTH)}** (${probability}%)`
				: `${emoji.dot} **${truncateText(trigger, CONSTANTS.MAX_TRIGGER_LENGTH)}**`;

		// Format replies with separators
		const formattedReplies = replies
			.map(reply => truncateText(reply.trim(), maxReplyLength))
			.join(CONSTANTS.REPLY_SEPARATOR);

		return {
			trigger: triggerText,
			reply: formattedReplies,
			type,
			mode
		};
	});
}

/**
 * Get paginated list data
 * @param {GuildEntry[]} guilddb - Guild database
 * @returns {ListData} Paginated data
 */
function getLists(guilddb: GuildEntry[]): ListData {
	const cacheKey = createCacheKey(guilddb);
	const cached = listCache.get(cacheKey);

	if (cached) {
		return cached;
	}

	const processedData = processGuildData(guilddb);
	const totalPages: ProcessedEntry[][] = [];

	// Split into chunks to avoid field limit
	for (let i = 0; i < processedData.length; i += CONSTANTS.CHUNK_SIZE) {
		totalPages.push(processedData.slice(i, i + CONSTANTS.CHUNK_SIZE));
	}

	const result = { totalPages };
	listCache.set(cacheKey, result);

	return result;
}

/**
 * Create Discord embed for list display
 * @param {Interaction} interaction - Discord interaction
 * @param {GuildEntry[]} guilddb - Guild database
 * @param {ProcessedEntry[][]} totalPages - Total pages
 * @param {number} currentPage - Current page
 * @returns {EmbedBuilder} Discord embed
 */
function getListEmbed(
	interaction: Interaction,
	guilddb: GuildEntry[],
	totalPages: ProcessedEntry[][],
	currentPage: number
): EmbedBuilder {
	try {
		const currentPageData = totalPages[currentPage] || [];

		// 创建字段数组
		const fields = currentPageData.map(field => ({
			name: truncateText(field.trigger, EMBED_LIMITS.FIELD_NAME_MAX),
			value: `${truncateText(field.reply, EMBED_LIMITS.FIELD_VALUE_MAX - 50)}\n\`${field.type}\`/\`${field.mode}\``,
			inline: false
		}));

		// 如果没有数据，添加提示字段
		if (fields.length === 0) {
			fields.push({
				name: "📝 詞彙列表",
				value: "此頁面沒有詞彙資料",
				inline: false
			});
		}

		const embed = createSafeEmbed({
			title: `${interaction.guild?.name} 的詞彙列表 - ${guilddb.length}個詞彙`,
			color: CONSTANTS.EMBED_COLOR,
			fields: fields,
			footer: `第 ${currentPage + 1}/${totalPages.length} 頁 • ${moment(new Date()).format(CONSTANTS.DATE_FORMAT)}`,
			thumbnail:
				interaction.guild?.iconURL({
					size: 4096,
					forceStatic: false
				}) || ""
		});

		return embed;
	} catch (error) {
		console.error("Error creating list embed:", error);
		// 返回错误 Embed
		return createSafeEmbed({
			title: "❌ 錯誤",
			description: "創建詞彙列表時發生錯誤",
			color: "#EE4E4E"
		});
	}
}

/**
 * Create components for list navigation
 * @param {ProcessedEntry[][]} totalPages - Total pages
 * @returns {ActionRowBuilder<ButtonBuilder>[]} Discord components
 */
function getListComponents(
	totalPages: ProcessedEntry[][]
): ActionRowBuilder<ButtonBuilder>[] {
	const isMultiPage = totalPages.length > 1;

	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("listBack")
				.setEmoji("⬅")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!isMultiPage),
			new ButtonBuilder()
				.setCustomId("listRefresh")
				.setEmoji("🔄")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId("listNext")
				.setEmoji("➡")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!isMultiPage)
		)
	];
}

// Clean up old cache entries periodically
setInterval(
	() => {
		listCache.clear();
	},
	5 * 60 * 1000
); // Clear cache every 5 minutes

export { getLists, getListEmbed, getListComponents };
