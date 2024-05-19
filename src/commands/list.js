import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { getLists, getListEmbed, getListComponents } from "../services/list.js";

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
				.setDescription("...")
				.setRequired(false)
		),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, db) {
		const guilddb = await db.get(`${interaction.guild.id}.replies`);
		const visible = interaction.options.getBoolean("visible") ?? false;

		if (!guilddb) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
						)
						.setTitle("我沒有在這個伺服器找到任何詞彙！")
						.setConfig("#EE4E4E")
				],
				ephemeral: true
			});
		}

		const currentPage = 0;
		const { totalPages } = getLists(guilddb);
		await db.set(`${interaction.guild.id}.list`, {
			currentPage: currentPage
		});

		interaction.reply({
			embeds: [
				getListEmbed(interaction, guilddb, totalPages, currentPage)
			],
			components: getListComponents(totalPages),
			ephemeral: !visible
		});
	}
};
