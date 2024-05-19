import {
	CommandInteraction,
	SlashCommandBuilder,
	ModalBuilder,
	TextInputBuilder,
	ActionRowBuilder,
	TextInputStyle
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("add")
		.setDescription("Add vocabulary to server")
		.setNameLocalizations({
			"zh-TW": "添加"
		})
		.setDescriptionLocalizations({
			"zh-TW": "為伺服器添加詞彙"
		}),
	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, db) {
		await interaction.showModal(
			new ModalBuilder()
				.setCustomId("add")
				.setTitle("添加詞彙")
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_trigger")
							.setLabel("想要觸發回覆的詞彙")
							.setPlaceholder("你好")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
							.setMinLength(1)
							.setMaxLength(4000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_reply")
							.setLabel(
								"回覆的詞彙，在詞彙中間添加 </> 會變成隨機回覆(如範例)"
							)
							.setPlaceholder("哈囉！\n</>\n你好！")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
							.setMinLength(1)
							.setMaxLength(4000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_type")
							.setLabel("回覆的類型 (相同, 包含)")
							.setValue("相同")
							.setPlaceholder("相同, 包含")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
							.setMinLength(2)
							.setMaxLength(10)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_mode")
							.setLabel("發送訊息類型 (回覆, 訊息)")
							.setValue("回覆")
							.setPlaceholder("回覆, 訊息")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
							.setMinLength(2)
							.setMaxLength(10)
					)
				)
		);
	}
};
