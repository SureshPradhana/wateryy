import dotenv from "dotenv";
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import mongoose from 'mongoose';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import QRCode from 'qrcode';
dotenv.config();

// ----------------- MongoDB Models -----------------
const { Schema, model } = mongoose;

const UserSettingsSchema = new Schema({
	user_id: { type: String, required: true, unique: true },
	timer_minutes: { type: Number, default: 25 },
	water_amount: { type: Number, default: 250 },
	weight_kg: { type: Number, default: null },
	height_cm: { type: Number, default: null },
	reminder_active: { type: Boolean, default: false },
	last_reminder: { type: Date, default: null }
}, { timestamps: true });

const WaterLogSchema = new Schema({
	user_id: { type: String, required: true, index: true },
	amount: { type: Number, required: true },
	timestamp: { type: Date, default: Date.now, index: true }
});

// NEW: Suggestion Schema
const SuggestionSchema = new Schema({
	user_id: { type: String, required: true, index: true },
	username: { type: String, required: true },
	type: { type: String, enum: ['suggestion', 'issue'], required: true },
	content: { type: String, required: true },
	timestamp: { type: Date, default: Date.now, index: true }
});

const UserSettings = model('UserSettings', UserSettingsSchema);
const WaterLog = model('WaterLog', WaterLogSchema);
const Suggestion = model('Suggestion', SuggestionSchema);

// ----------------- Connect to MongoDB -----------------
async function connectMongo() {
	const uri = process.env.MONGO_URI;
	if (!uri) {
		console.error('MONGO_URI not set in environment');
		process.exit(1);
	}
	try {
		await mongoose.connect(uri, {
			// options if needed
		});
		console.log('Connected to MongoDB');
	} catch (err) {
		console.error('MongoDB connection error:', err);
		process.exit(1);
	}
}
connectMongo();


// Initialize Discord client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages
	]
});

const DONATION_CONFIG = {
	cryptoAddresses: {
		bitcoin: 'bc1qcpradle8w4p5r4thldcudjsyde3qa0uk66j2kx',
		ethereum: '0x5f7b76c0825fc9b26ba13088e834804a15ae4b12',
		usdt_trc20: 'TFGcWZsE2zRyHXBUtuZSCBqpjZAwEo3YY3',
		usdt_erc20: '0x468c2838e64a3fa1c6b3683d0494a20eedf07e29',
		litecoin: 'ltc1qcjk32rhmw9t5hazj72qlhlu6amsd5z9gkxwcnv',
		dogecoin: 'DU6bMjG25Kcg7qu9DYT66N4YDf8oJjnUpt',
		solana: '3UTimbRKjAYCnJnNTN7hS17a9esNQs5jP7RkJgpyniZ5',
		nano: 'nano_1b15trz5bbpseeob71wuq37mm36bewq377tyeu83ndzacgdqpzw9eh1fkxoj',
		pepecoin: 'PmzT8BUhqWzavKVSwBbA9KuHojrvmGj7VD'
	}
};


// Helper functions
function calculateWaterGoal(weight, height) {
	if (!weight || !height) return 2000;
	return Math.round(weight * 33);
}

function getBMIInfo(weight, height) {
	if (!weight || !height) return null;

	const bmi = weight / ((height / 100) ** 2);
	let category;

	if (bmi < 18.5) category = "Underweight";
	else if (bmi < 25) category = "Normal weight";
	else if (bmi < 30) category = "Overweight";
	else category = "Obese";

	return { bmi: bmi.toFixed(1), category };
}

// Check reminders every minute
setInterval(async () => {
	try {
		const rows = await UserSettings.find({ reminder_active: true }).exec();

		for (const row of rows) {
			const now = new Date();
			let shouldRemind = false;

			if (row.last_reminder) {
				const lastTime = new Date(row.last_reminder);
				const diffMinutes = (now - lastTime) / (1000 * 60);
				shouldRemind = diffMinutes >= row.timer_minutes;
			} else {
				shouldRemind = true;
			}

			if (shouldRemind) {
				try {
					const user = await client.users.fetch(row.user_id);

					const button = new ButtonBuilder()
						.setCustomId(`drink_${row.user_id}_${row.water_amount}`)
						.setLabel('I Drank!')
						.setStyle(ButtonStyle.Primary)
						.setEmoji('💧');

					const row_btn = new ActionRowBuilder().addComponents(button);

					await user.send({
						content: `💧 **Water Reminder!** 💧\nTime to drink ${row.water_amount}ml of water!`,
						components: [row_btn]
					});

					await UserSettings.findOneAndUpdate(
						{ user_id: row.user_id },
						{ last_reminder: now },
						{ new: true, upsert: false }
					).exec();
				} catch (error) {
					console.error(`Error sending reminder to ${row.user_id}:`, error);
				}
			}
		}
	} catch (err) {
		console.error('Error checking reminders:', err);
	}
}, 60000); // Check every minute

// Handle button interactions
client.on('interactionCreate', async interaction => {
	if (interaction.isButton()) {
		const [action, userId, amount] = interaction.customId.split('_');

		if (action === 'drink') {
			if (interaction.user.id !== userId) {
				return interaction.reply({ content: 'This reminder is not for you!', ephemeral: true });
			}

			try {
				const waterLog = new WaterLog({
					user_id: userId,
					amount: parseInt(amount)
				});
				await waterLog.save();

				await interaction.reply({ content: `✅ Great job! Logged ${amount}ml of water.`, ephemeral: true });
				await interaction.message.edit({
					content: `~~${interaction.message.content}~~ ✅ Completed`,
					components: []
				});
			} catch (err) {
				console.error('Error logging water intake:', err);
				return interaction.reply({ content: '❌ Error logging water intake', ephemeral: true });
			}
		}
		// NEW: Handle crypto button clicks
		if (interaction.customId.startsWith('crypto_')) {
			await interaction.deferReply({ ephemeral: true });

			const cryptoType = interaction.customId.replace('crypto_', '');
			let address = '';
			let cryptoName = '';
			let network = '';

			switch (cryptoType) {
				case 'bitcoin':
					address = DONATION_CONFIG.cryptoAddresses.bitcoin;
					cryptoName = 'Bitcoin (BTC)';
					network = 'Bitcoin Network';
					break;
				case 'ethereum':
					address = DONATION_CONFIG.cryptoAddresses.ethereum;
					cryptoName = 'Ethereum (ETH)';
					network = 'Ethereum Network';
					break;
				case 'usdt_trc20':
					address = DONATION_CONFIG.cryptoAddresses.usdt_trc20;
					cryptoName = 'USDT (Tether)';
					network = 'TRC20 (Tron Network)';
					break;
				case 'usdt_erc20':
					address = DONATION_CONFIG.cryptoAddresses.usdt_erc20;
					cryptoName = 'USDT (Tether)';
					network = 'ERC20 (Ethereum Network)';
					break;
				case 'litecoin':
					address = DONATION_CONFIG.cryptoAddresses.litecoin;
					cryptoName = 'Litecoin (LTC)';
					network = 'Litecoin Network';
					break;
				case 'dogecoin':
					address = DONATION_CONFIG.cryptoAddresses.dogecoin;
					cryptoName = 'Dogecoin (DOGE)';
					network = 'Dogecoin Network';
					break;
				case 'solana':
					address = DONATION_CONFIG.cryptoAddresses.solana;
					cryptoName = 'Solana (SOL)';
					network = 'Solana Network';
					break;
				case 'nano':
					address = DONATION_CONFIG.cryptoAddresses.nano;
					cryptoName = 'Nano (NANO)';
					network = 'Nano Network';
					break;
				case 'pepecoin':
					address = DONATION_CONFIG.cryptoAddresses.pepecoin;
					cryptoName = 'Pepecoin (PEPE)';
					network = 'Pepecoin Network';
					break;
			}

			try {
				// Generate QR code
				const qrCodeBuffer = await QRCode.toBuffer(address, {
					width: 400,
					margin: 2,
					color: {
						dark: '#000000',
						light: '#FFFFFF'
					}
				});

				const embed = new EmbedBuilder()
					.setTitle(`💰 ${cryptoName} Donation`)
					.setDescription(
						`**Network:** ${network}\n\n` +
						`**Address:**\n\`\`\`${address}\`\`\`\n` +
						`⚠️ **Important:** Make sure you're sending on the correct network!\n\n` +
						`📱 Scan the QR code below or copy the address above.\n\n` +
						`Thank you for your support! ❤️`
					)
					.setColor(0x2ecc71)
					.setImage('attachment://qr-code.png')
					.setFooter({ text: 'Double-check the address before sending!' })
					.setTimestamp();

				await interaction.editReply({
					embeds: [embed],
					files: [{ attachment: qrCodeBuffer, name: 'qr-code.png' }]
				});
			} catch (error) {
				console.error('Error generating QR code:', error);

				const errorEmbed = new EmbedBuilder()
					.setTitle(`💰 ${cryptoName} Donation`)
					.setDescription(
						`**Network:** ${network}\n\n` +
						`**Address:**\n\`\`\`${address}\`\`\`\n` +
						`⚠️ **Important:** Make sure you're sending on the correct network!\n\n` +
						`Copy the address above to make your donation.\n\n` +
						`Thank you for your support! ❤️`
					)
					.setColor(0x2ecc71)
					.setFooter({ text: 'Double-check the address before sending!' });

				await interaction.editReply({ embeds: [errorEmbed] });
			}
		}
	}

	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	// /start command
	if (commandName === 'start') {
		try {
			let settings = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			if (!settings) {
				settings = new UserSettings({ user_id: interaction.user.id });
				await settings.save();
			}

			settings.reminder_active = true;
			settings.last_reminder = null;
			await settings.save();

			// refresh settings for message
			const s = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			interaction.reply(`✅ Water reminders started! I'll remind you every ${s.timer_minutes} minutes to drink ${s.water_amount}ml.`);
		} catch (err) {
			console.error('/start error:', err);
			interaction.reply('❌ Could not start reminders due to a server error.');
		}
	}

	// /stop command
	else if (commandName === 'stop') {
		try {
			await UserSettings.findOneAndUpdate({ user_id: interaction.user.id }, { reminder_active: false }).exec();
			interaction.reply('⏹️ Water reminders stopped.');
		} catch (err) {
			console.error('/stop error:', err);
			interaction.reply('❌ Could not stop reminders due to a server error.');
		}
	}

	// /set command
	else if (commandName === 'set') {
		const timer = interaction.options.getInteger('timer');
		const amount = interaction.options.getInteger('amount');

		if (timer < 1 || amount < 1) {
			return interaction.reply('❌ Timer and amount must be positive numbers!');
		}

		try {
			let settings = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			if (!settings) {
				settings = new UserSettings({
					user_id: interaction.user.id,
					timer_minutes: timer,
					water_amount: amount
				});
				await settings.save();
			} else {
				settings.timer_minutes = timer;
				settings.water_amount = amount;
				await settings.save();
			}

			interaction.reply(`⚙️ Settings updated! Timer: ${timer} minutes, Amount: ${amount}ml`);
		} catch (err) {
			console.error('/set error:', err);
			interaction.reply('❌ Could not update settings due to a server error.');
		}
	}

	// /setbmi command
	else if (commandName === 'setbmi') {
		const weight = interaction.options.getNumber('weight');
		const height = interaction.options.getNumber('height');

		if (weight <= 0 || height <= 0) {
			return interaction.reply('❌ Please enter valid weight and height!');
		}

		try {
			let settings = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			if (!settings) {
				settings = new UserSettings({
					user_id: interaction.user.id,
					weight_kg: weight,
					height_cm: height
				});
				await settings.save();
			} else {
				settings.weight_kg = weight;
				settings.height_cm = height;
				await settings.save();
			}

			const bmiInfo = getBMIInfo(weight, height);
			const dailyGoal = calculateWaterGoal(weight, height);

			interaction.reply(
				`✅ BMI info saved!\n` +
				`📊 BMI: ${bmiInfo.bmi} (${bmiInfo.category})\n` +
				`💧 Recommended daily intake: ${dailyGoal}ml (${(dailyGoal / 1000).toFixed(1)}L)`
			);
		} catch (err) {
			console.error('/setbmi error:', err);
			interaction.reply('❌ Could not save BMI due to a server error.');
		}

	}

	// /add command
	else if (commandName === 'add') {
		const amount = interaction.options.getInteger('amount');

		if (amount <= 0) {
			return interaction.reply('❌ Amount must be positive!');
		}

		try {
			const log = new WaterLog({ user_id: interaction.user.id, amount });
			await log.save();
			interaction.reply(`✅ Added ${amount}ml to your water intake!`);
		} catch (err) {
			console.error('/add error:', err);
			interaction.reply('❌ Error adding water intake');
		}
	}

	// /stats command
	else if (commandName === 'stats') {
		await interaction.deferReply();

		const period = interaction.options.getString('period') || 'today';

		try {
			const userData = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			const dailyGoal = userData ? calculateWaterGoal(userData.weight_kg, userData.height_cm) : 2000;

			const userNow = new Date(interaction.createdTimestamp);
			let startDate;
			let title;

			if (period === 'today') {
				startDate = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate());
				title = 'Today';
			} else if (period === 'week') {
				startDate = new Date(userNow);
				startDate.setDate(userNow.getDate() - userNow.getDay());
				startDate.setHours(0, 0, 0, 0);
				title = 'This Week';
			} else if (period === 'month') {
				startDate = new Date(userNow.getFullYear(), userNow.getMonth(), 1);
				title = 'This Month';
			} else {
				startDate = new Date(userNow.getFullYear(), 0, 1);
				title = 'This Year';
			}

			// aggregate water logs by date
			const data = await WaterLog.aggregate([
				{
					$match: {
						user_id: interaction.user.id,
						timestamp: { $gte: startDate }
					}
				},
				{
					$group: {
						_id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
						total: { $sum: "$amount" }
					}
				},
				{ $sort: { "_id": 1 } }
			]).exec();

			if (!data || data.length === 0) {
				return interaction.editReply(`No water intake data for ${title.toLowerCase()}.`);
			}

			const dates = data.map(row => row._id);
			const amounts = data.map(row => row.total);

			// Generate chart
			const width = 800;
			const height = 400;
			const chartCallback = new ChartJSNodeCanvas({ width, height });

			const configuration = {
				type: 'bar',
				data: {
					labels: dates,
					datasets: [
						{
							label: 'Water Intake (ml)',
							data: amounts,
							backgroundColor: 'rgba(52, 152, 219, 0.8)',
							borderColor: 'rgba(52, 152, 219, 1)',
							borderWidth: 1
						},
						{
							label: `Daily Goal (${dailyGoal}ml)`,
							data: Array(dates.length).fill(dailyGoal),
							type: 'line',
							borderColor: 'rgba(46, 204, 113, 1)',
							borderWidth: 2,
							borderDash: [5, 5],
							fill: false,
							pointRadius: 0
						}
					]
				},
				options: {
					responsive: true,
					plugins: {
						title: {
							display: true,
							text: `Water Intake - ${title}`,
							font: { size: 18 }
						},
						legend: {
							display: true
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: 'Amount (ml)'
							}
						},
						x: {
							title: {
								display: true,
								text: 'Date'
							}
						}
					}
				}
			};

			const imageBuffer = await chartCallback.renderToBuffer(configuration);

			const total = amounts.reduce((a, b) => a + b, 0);
			const avg = Math.round(total / amounts.length);

			const embed = new EmbedBuilder()
				.setTitle(`💧 Water Intake Stats - ${title}`)
				.setColor(0x3498db)
				.addFields(
					{ name: 'Total', value: `${total}ml (${(total / 1000).toFixed(1)}L)`, inline: true },
					{ name: 'Average/Day', value: `${avg}ml`, inline: true },
					{ name: 'Daily Goal', value: `${dailyGoal}ml`, inline: true }
				)
				.setImage('attachment://water_stats.png');

			interaction.editReply({
				embeds: [embed],
				files: [{ attachment: imageBuffer, name: 'water_stats.png' }]
			});
		} catch (err) {
			console.error('/stats error:', err);
			interaction.editReply('❌ Could not fetch stats due to a server error.');
		}
	}


	// /waterintakeinfo command
	else if (commandName === 'waterintakeinfo') {
		try {
			const userData = await UserSettings.findOne({ user_id: interaction.user.id }).exec();
			if (!userData || !userData.weight_kg || !userData.height_cm) {
				return interaction.reply('❌ Please set your BMI first using `/setbmi weight height`');
			}

			const { weight_kg, height_cm } = userData;
			const bmiInfo = getBMIInfo(weight_kg, height_cm);
			const dailyGoal = calculateWaterGoal(weight_kg, height_cm);

			// sum today's intake
			const startOfToday = new Date();
			startOfToday.setHours(0, 0, 0, 0);

			const result = await WaterLog.aggregate([
				{
					$match: {
						user_id: interaction.user.id,
						timestamp: { $gte: startOfToday }
					}
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$amount" }
					}
				}
			]).exec();

			const todayIntake = (result && result[0] && result[0].total) ? result[0].total : 0;
			const percentage = ((todayIntake / dailyGoal) * 100).toFixed(1);
			const remaining = Math.max(0, dailyGoal - todayIntake);

			const embed = new EmbedBuilder()
				.setTitle('💧 Your Water Intake Info')
				.setColor(0x3498db)
				.addFields(
					{ name: '📏 Height', value: `${height_cm}cm`, inline: true },
					{ name: '⚖️ Weight', value: `${weight_kg}kg`, inline: true },
					{ name: '📊 BMI', value: `${bmiInfo.bmi} (${bmiInfo.category})`, inline: true },
					{ name: '🎯 Daily Goal', value: `${dailyGoal}ml (${(dailyGoal / 1000).toFixed(1)}L)`, inline: true },
					{ name: '💧 Today\'s Intake', value: `${todayIntake}ml (${percentage}%)`, inline: true },
					{ name: '📈 Remaining', value: `${remaining}ml`, inline: true },
					{
						name: 'ℹ️ Why This Amount?',
						value: `Based on your body weight (${weight_kg}kg), the recommended water intake is approximately 33ml per kilogram of body weight per day. This helps maintain proper hydration for your body's needs.`,
						inline: false
					}
				);

			interaction.reply({ embeds: [embed] });
		} catch (err) {
			console.error('/waterintakeinfo error:', err);
			interaction.reply('❌ Could not fetch water intake info due to a server error.');
		}
	}
	//donate command
	else if (commandName === 'donate') {
		const embed = new EmbedBuilder()
			.setTitle('💝 Support the Bot')
			.setDescription(
				`Thank you for considering supporting this bot!\n\n` +
				`Your donations help keep the bot running 24/7 and support future development.\n\n` +
				`**Select a cryptocurrency below to view the donation address and QR code:**`
			)
			.setColor(0x3498db)
			.setFooter({ text: 'Click any button below to get the address' })
			.setTimestamp();

		// Create buttons for each crypto
		const row1 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('crypto_bitcoin')
					.setLabel('Bitcoin (BTC)')
					.setStyle(ButtonStyle.Primary)
					.setEmoji('🪙'),
				new ButtonBuilder()
					.setCustomId('crypto_ethereum')
					.setLabel('Ethereum (ETH)')
					.setStyle(ButtonStyle.Primary)
					.setEmoji('🔷'),
				new ButtonBuilder()
					.setCustomId('crypto_litecoin')
					.setLabel('Litecoin (LTC)')
					.setStyle(ButtonStyle.Primary)
					.setEmoji('⛏️'),
			);

		const row2 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('crypto_usdt_trc20')
					.setLabel('USDT (TRC20)')
					.setStyle(ButtonStyle.Success)
					.setEmoji('💵'),
				new ButtonBuilder()
					.setCustomId('crypto_usdt_erc20')
					.setLabel('USDT (ERC20)')
					.setStyle(ButtonStyle.Success)
					.setEmoji('💵'),
				new ButtonBuilder()
					.setCustomId('crypto_dogecoin')
					.setLabel('Dogecoin (DOGE)')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('🐶')
			);
		const row3 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('crypto_solana')
					.setLabel('Solana (SOL)')
					.setStyle(ButtonStyle.Success)
					.setEmoji('💵'),
				new ButtonBuilder()
					.setCustomId('crypto_nano')
					.setLabel('Nano (XNO)')
					.setStyle(ButtonStyle.Success)
					.setEmoji('💵'),
				new ButtonBuilder()
					.setCustomId('crypto_pepecoin')
					.setLabel('Pepecoin (pepe)')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('🐸')
			);
		await interaction.reply({ embeds: [embed], components: [row1, row2, row3] });
	}
	// /suggest command
	else if (commandName === 'suggest') {
		const type = interaction.options.getString('type');
		const content = interaction.options.getString('content');

		try {
			const newSuggestion = new Suggestion({
				user_id: interaction.user.id,
				username: interaction.user.username,
				type,
				content
			});

			await newSuggestion.save();

			const embed = new EmbedBuilder()
				.setTitle('📬 Suggestion Submitted')
				.setColor(0x2ecc71)
				.addFields(
					{ name: 'Type', value: type, inline: true },
					{ name: 'Submitted By', value: interaction.user.username, inline: true },
					{ name: 'Content', value: content }
				)
				.setTimestamp();

			await interaction.reply({ embeds: [embed], ephemeral: true });

		} catch (err) {
			console.error('/suggest error:', err);
			interaction.reply({ content: '❌ Could not save your suggestion.', ephemeral: true });
		}
	}
	else if (commandName === 'help') {
		const embed = new EmbedBuilder()
			.setTitle('📘 Bot Help Menu')
			.setColor(0x3498db)
			.setDescription('Here are all available commands:')
			.addFields(
				{ name: '/start', value: 'Start water reminders' },
				{ name: '/stop', value: 'Stop water reminders' },
				{ name: '/set', value: 'Set timer & amount' },
				{ name: '/add', value: 'Add manual water intake' },
				{ name: '/stats', value: 'Show water stats with charts' },
				{ name: '/setbmi', value: 'Set BMI data' },
				{ name: '/waterintakeinfo', value: 'Show intake & BMI info' },
				{ name: '/donate', value: 'Support the bot ❤️' },
				{ name: '/suggest', value: 'Submit suggestions or issues' },
				{ name: '/help', value: 'Show this help menu' }
			)
			.setFooter({ text: 'Thanks for using the bot!' })
			.setTimestamp();

		interaction.reply({ embeds: [embed], ephemeral: true });
	}


});

// Register slash commands
client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);

	const commands = [
		new SlashCommandBuilder()
			.setName('start')
			.setDescription('Start water intake reminders'),

		new SlashCommandBuilder()
			.setName('stop')
			.setDescription('Stop water intake reminders'),

		new SlashCommandBuilder()
			.setName('set')
			.setDescription('Set reminder timer and water amount')
			.addIntegerOption(option =>
				option.setName('timer')
					.setDescription('Timer in minutes (e.g., 30)')
					.setRequired(true))
			.addIntegerOption(option =>
				option.setName('amount')
					.setDescription('Water amount in ml (e.g., 250)')
					.setRequired(true)),

		new SlashCommandBuilder()
			.setName('setbmi')
			.setDescription('Set your weight and height for personalized recommendations')
			.addNumberOption(option =>
				option.setName('weight')
					.setDescription('Your weight in kg')
					.setRequired(true))
			.addNumberOption(option =>
				option.setName('height')
					.setDescription('Your height in cm')
					.setRequired(true)),

		new SlashCommandBuilder()
			.setName('add')
			.setDescription('Manually add water intake')
			.addIntegerOption(option =>
				option.setName('amount')
					.setDescription('Amount of water in ml')
					.setRequired(true)),

		new SlashCommandBuilder()
			.setName('stats')
			.setDescription('View your water intake statistics')
			.addStringOption(option =>
				option.setName('period')
					.setDescription('Choose time period')
					.addChoices(
						{ name: 'Today', value: 'today' },
						{ name: 'This Week', value: 'week' },
						{ name: 'This Month', value: 'month' },
						{ name: 'This Year', value: 'year' }
					)),

		new SlashCommandBuilder()
			.setName('waterintakeinfo')
			.setDescription('Get personalized water intake recommendations'),

		new SlashCommandBuilder()
			.setName('donate')
			.setDescription('Support the bot with crypto donations'),
		new SlashCommandBuilder()
			.setName('suggest')
			.setDescription('Submit a suggestion or report an issue')
			.addStringOption(option =>
				option.setName('type')
					.setDescription('Choose suggestion or issue')
					.setRequired(true)
					.addChoices(
						{ name: 'Suggestion', value: 'suggestion' },
						{ name: 'Issue', value: 'issue' }
					)
			)
			.addStringOption(option =>
				option.setName('content')
					.setDescription('Write your suggestion or issue')
					.setRequired(true)
			),

		new SlashCommandBuilder()
			.setName('help')
			.setDescription('Shows all bot commands and info'),
	];

	try {
		await client.application.commands.set(commands);
		console.log('Successfully registered application commands.');
	} catch (error) {
		console.error('Error registering commands:', error);
	}
});

// Login
client.login(process.env.BOT_TOKEN);
