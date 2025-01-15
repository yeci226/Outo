import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { GuildDataManager } from "../events/reply.js";

export default {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("remove vocabulary for server")
		.setNameLocalizations({ "zh-TW": "刪除" })
		.setDescriptionLocalizations({ "zh-TW": "為伺服器刪除詞彙" })
		.addStringOption(option =>
			option
				.setName("vocabulary")
				.setDescription("Word to delete")
				.setNameLocalizations({ "zh-TW": "詞彙" })
				.setDescriptionLocalizations({ "zh-TW": "想要刪除的詞彙" })
				.setAutocomplete(true)
				.setRequired(true)
		),

	/**
	 * Execute the remove command
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 * @param {Object} db Database instance
	 */
	async execute(client, interaction, args, db) {
		try {
			// Get guild data
			const guildId = interaction.guild.id;
			const guildData = await db.get(`${guildId}`);
			const replies = guildData?.replies || [];

			if (!replies.length) {
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
							)
							.setTitle("我沒有在這個伺服器找到任何詞彙！")
							.setColor("#EE4E4E")
					],
					ephemeral: true
				});
			}

			const vocabularyId = interaction.options.getString("vocabulary");

			// Find the vocabulary item by its ID (index)
			const index = parseInt(vocabularyId);
			if (isNaN(index) || index < 0 || index >= replies.length) {
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setThumbnail(
								"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
							)
							.setTitle("未找到可刪除的詞彙！")
							.setColor("#EE4E4E")
					],
					ephemeral: true
				});
			}

			// Store the trigger before removing
			const trigger = replies[index].trigger;

			// Remove the vocabulary
			replies.splice(index, 1);

			// Update database
			await db.set(`${guildId}`, { replies });

			// Update cache
			GuildDataManager.updateCache(guildId, replies);

			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552199450333204/discord.gif"
						)
						.setTitle("已刪除詞彙")
						.addFields({
							name: "觸發詞",
							value: `\`${trigger.length > 2048 ? trigger.slice(0, 2045) + "..." : trigger}\``,
							inline: false
						})
						.setColor("#A1DD70")
				],
				ephemeral: true
			});
		} catch (error) {
			console.error("Remove command error:", error);
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
						)
						.setTitle("刪除詞彙時發生錯誤！")
						.setColor("#EE4E4E")
				],
				ephemeral: true
			});
		}
	}
};
