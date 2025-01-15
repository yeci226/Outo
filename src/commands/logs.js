import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const CONSTANTS = {
	SUCCESS_COLOR: "#A1DD70",
	ERROR_COLOR: "#EE4E4E",
	ERROR_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif",
	ACTION_EMOJIS: {
		add: "📝", // Writing emoji for add
		delete: "🗑️", // Trash bin for delete
		modify: "✏️" // Pencil for modify
	}
};

// Helper function to format timestamp
function formatTimestamp(timestamp) {
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
function formatLogEntry(log) {
	const emoji = CONSTANTS.ACTION_EMOJIS[log.action];
	let content = "";

	switch (log.action) {
		case "add":
			content = [
				`${emoji} **新增觸發詞:** \`${log.details.trigger}\``,
				`└ 回覆: ${log.details.replies.map(r => `\`${r}\``).join(", ")}`,
				`└ 類型: \`${log.details.type}\``,
				`└ 模式: \`${log.details.mode}\``,
				`└ 機率: \`${log.details.probability}%\``
			].join("\n");
			break;

		case "modify":
			content = [
				`${emoji} **修改觸發詞:** \`${log.details.trigger}\``,
				`└ 新回覆: ${log.details.replies.map(r => `\`${r}\``).join(", ")}`,
				`└ 新類型: \`${log.details.type}\``,
				`└ 新模式: \`${log.details.mode}\``,
				`└ 新機率: \`${log.details.probability}%\``
			].join("\n");
			break;

		case "delete":
			content = `${emoji} **刪除觸發詞:** \`${log.details.trigger}\``;
			break;
	}

	return {
		name: `${formatTimestamp(log.timestamp)} • ${log.username}`,
		value: content,
		inline: false
	};
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

	async execute(client, interaction, args, db) {
		try {
			const logs = (await db.get(`${interaction.guild.id}.logs`)) || [];
			const isVisible =
				interaction.options.getBoolean("visible") ?? false;

			if (!logs || logs.length === 0) {
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor(CONSTANTS.SUCCESS_COLOR)
							.setTitle("📋 執行紀錄")
							.setDescription("目前沒有任何紀錄")
					],
					ephemeral: !isVisible
				});
			}

			const itemsPerPage = 5;
			const maxPages = Math.ceil(logs.length / itemsPerPage);
			const page = Math.min(
				Math.max(interaction.options.getInteger("page") || 1, 1),
				maxPages
			);

			const startIdx = (page - 1) * itemsPerPage;
			const pageItems = logs.slice(startIdx, startIdx + itemsPerPage);

			const embed = new EmbedBuilder()
				.setColor(CONSTANTS.SUCCESS_COLOR)
				.setTitle("📋 機器人執行紀錄")
				.setFields(pageItems.map(formatLogEntry))
				.setFooter({
					text: `第 ${page}/${maxPages} 頁 • 共 ${logs.length} 筆紀錄`
				})
				.setTimestamp();

			await interaction.reply({
				embeds: [embed],
				ephemeral: !isVisible
			});
		} catch (error) {
			console.error("Error displaying logs:", error);
			await interaction.reply({
				embeds: [createErrorEmbed("顯示紀錄時發生錯誤")],
				ephemeral: true
			});
		}
	}
};
