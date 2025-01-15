import { client } from "../index.js";
import {
	ApplicationCommandOptionType,
	Events,
	EmbedBuilder,
	WebhookClient,
	ChannelType
} from "discord.js";
import { Logger } from "../services/logger.js";

const emoji = client.emoji;
const db = client.db;
const webhook = new WebhookClient({ url: process.env.CMDWEBHOOK });

// Handle autocomplete interactions
async function handleAutocomplete(interaction) {
	if (interaction.options._hoistedOptions[0].name !== "trigger") return;

	try {
		const guildId = interaction.guild.id;
		const guildData = await db.get(`${guildId}.replies`);

		if (!guildData?.length) {
			return await interaction.respond([]);
		}

		const input = (
			interaction.options.getString("trigger") || ""
		).toLowerCase();

		const options = guildData
			.map(item => ({
				trigger: item.trigger
			}))
			.filter(item => item.trigger.toLowerCase().includes(input))
			.slice(0, 25)
			.map(item => ({
				name:
					item.trigger.length > 100
						? `${item.trigger.slice(0, 97)}...`
						: item.trigger,
				value: item.trigger // Use trigger as value instead of index
			}));

		await interaction.respond(options);
	} catch (error) {
		console.error("Autocomplete error:", error);
		await interaction.respond([]);
	}
}

// Handle slash commands
async function handleSlashCommand(interaction) {
	const command = client.commands.slash.get(interaction.commandName);
	if (!command) {
		return interaction.followUp({
			content: "An error has occurred",
			ephemeral: true
		});
	}

	const args = interaction.options.data.reduce((acc, option) => {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			if (option.name) acc.push(option.name);
			option.options?.forEach(x => {
				if (x.value) acc.push(x.value);
			});
		} else if (option.value) {
			acc.push(option.value);
		}
		return acc;
	}, []);

	try {
		await command.execute(client, interaction, args, db, emoji);
		logCommandExecution(interaction, command);
	} catch (error) {
		console.error("Command execution error:", error);
		new Logger("指令").error(`錯誤訊息：${error.message}`);

		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	}
}

// Log command execution
function logCommandExecution(interaction, command) {
	const executionTime = (
		(Date.now() - interaction.createdTimestamp) /
		1000
	).toFixed(2);
	const timeString = `花費 ${executionTime} 秒`;

	new Logger("指令").command(
		`${interaction.user.displayName}(${interaction.user.id}) 執行 ${command.data.name} - ${timeString}`
	);

	const embedFields = {
		name: command.data.name,
		value: [
			interaction.options._subcommand
				? `> ${interaction.options._subcommand}`
				: "\u200b",
			interaction.options._hoistedOptions.length > 0
				? ` \`${interaction.options._hoistedOptions[0].value}\``
				: "\u200b"
		].join(""),
		inline: true
	};

	webhook.send({
		embeds: [
			new EmbedBuilder()
				.setColor(null)
				.setFooter({ text: timeString })
				.setTimestamp()
				.setAuthor({
					iconURL: interaction.user.displayAvatarURL({
						size: 4096,
						dynamic: true
					}),
					name: `${interaction.user.username} - ${interaction.user.id}`
				})
				.setThumbnail(
					interaction.guild.iconURL({
						size: 4096,
						dynamic: true
					})
				)
				.setDescription(
					`\`\`\`${interaction.guild.name} - ${interaction.guild.id}\`\`\``
				)
				.addFields(embedFields)
		]
	});
}

// Main interaction handler
client.on(Events.InteractionCreate, async interaction => {
	if (interaction.channel.type === ChannelType.DM) return;

	try {
		if (interaction.isAutocomplete()) {
			await handleAutocomplete(interaction);
		} else if (interaction.isButton()) {
			await interaction.deferUpdate().catch(() => {});
		} else if (interaction.isCommand()) {
			await handleSlashCommand(interaction);
		} else if (interaction.isContextMenuCommand()) {
			const command = client.commands.slash.get(interaction.commandName);
			if (command) {
				await command.execute(client, interaction);
			}
		}
	} catch (error) {
		console.error("Interaction handling error:", error);
	}
});
