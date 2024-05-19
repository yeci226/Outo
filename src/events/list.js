import { client } from "../index.js";
import { getLists, getListEmbed, getListComponents } from "../services/list.js";
import { EmbedBuilder } from "discord.js";

const db = client.db;

client.on("interactionCreate", async interaction => {
	if (!interaction.isButton()) return;

	await interaction.deferUpdate().catch(() => {});
	const { customId, guildId } = interaction;

	if (!customId.startsWith("list")) return;

	const isListBack = customId === "listBack";
	const isListRefresh = customId === "listRefresh";
	const isListNext = customId === "listNext";

	if (!(isListBack || isListRefresh || isListNext)) return;

	const guilddb = await db.get(guildId);
	if (!guilddb?.replies?.length) {
		return interaction
			.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("我沒有在這個伺服器找到任何詞彙！")
						.setColor("#EE4E4E")
				],
				components: []
			})
			.catch(() => {});
	}

	const listdb = guilddb.list;
	let currentPage = listdb?.currentPage || 0;
	const { totalPages } = getLists(guilddb.replies);

	if (isListBack || isListNext) {
		currentPage = isListBack
			? (currentPage - 1 + totalPages.length) % totalPages.length
			: (currentPage + 1) % totalPages.length;

		await db.set(`${interaction.user.id}.list`, { currentPage });
	}

	return interaction
		.editReply({
			embeds: [
				getListEmbed(
					interaction,
					guilddb.replies,
					totalPages,
					currentPage
				)
			],
			components: getListComponents(totalPages)
		})
		.catch(() => {});
});
