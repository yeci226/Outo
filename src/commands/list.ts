import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	MessageFlags
} from "discord.js";
import { getLists, getListEmbed, getListComponents } from "../services/list.js";
import { createSafeEmbed } from "../utils/embedHelper.js";
import { database } from "../index.js";

export default {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription("View server vocabulary")
		.setNameLocalizations({
			"zh-TW": "列表"
		})
		.setDescriptionLocalizations({
			"zh-TW": "查看伺服器的詞彙列表"
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
		),
	/**
	 *
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(
		interaction: ChatInputCommandInteraction,
		...args: string[]
	): Promise<void> {
		const guildId = interaction.guild?.id;
		const guilddb = await database.get(`${guildId}.replies`);
		const visible = interaction.options.getBoolean("visible") ?? false;

		if (!guilddb) {
			await interaction.reply({
				embeds: [
					createSafeEmbed({
						title: "我沒有在這個伺服器找到任何詞彙！",
						color: "#EE4E4E",
						thumbnail:
							"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					})
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const currentPage = 0;
		const { totalPages } = getLists(guilddb);
		await database.set(`${interaction.guild?.id}.list`, {
			currentPage: currentPage
		});

		await interaction.reply({
			embeds: [
				getListEmbed(interaction, guilddb, totalPages, currentPage)
			],
			components: getListComponents(totalPages),
			flags: visible ? MessageFlags.Ephemeral : undefined
		});
	}
};
