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

	async execute(client, interaction, args, db) {
		const replyExample = [
			"當收到「你好」時，機器人將依序回覆:",
			"→ 嗨！",
			"→ 你好啊！",
			"在每句回覆之間加入 </> 來分隔不同回覆",
			"",
			"例如:",
			"嗨！",
			"</>",
			"你好啊！"
		].join("\n");

		await interaction.showModal(
			new ModalBuilder()
				.setCustomId("add")
				.setTitle("添加詞彙")
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_trigger")
							.setLabel("觸發詞 - 當看到這個詞時會觸發回覆")
							.setPlaceholder("例如: 你好")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
							.setMinLength(1)
							.setMaxLength(4000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_reply")
							.setLabel("回覆內容 - 使用 </> 分隔多個回覆")
							.setPlaceholder(replyExample)
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
							.setMinLength(1)
							.setMaxLength(4000)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_type")
							.setLabel(
								"觸發方式: 相同=完全相符, 包含=包含此詞即觸發"
							)
							.setValue("相同")
							.setPlaceholder("輸入: 相同 或 包含")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
							.setMinLength(2)
							.setMaxLength(10)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_mode")
							.setLabel(
								"回覆方式: 回覆=回覆原訊息, 訊息=發送新訊息"
							)
							.setValue("回覆")
							.setPlaceholder("輸入: 回覆 或 訊息")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
							.setMinLength(2)
							.setMaxLength(10)
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("add_probability")
							.setLabel("回覆機率 (0-100，預設100)")
							.setPlaceholder("100")
							.setValue("100")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
							.setMinLength(1)
							.setMaxLength(3)
					)
				)
		);
	}
};
