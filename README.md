# 💧 Wateryy - Discord Water Tracker Bot

A Discord bot that helps you stay hydrated by sending periodic water intake reminders and tracking your daily water consumption. Set personalized goals based on your BMI, view detailed statistics with charts, and maintain healthy hydration habits.

## ✨ Features

- **🔔 Automated Reminders**: Get DM reminders at customizable intervals to drink water
- **📊 BMI-Based Goals**: Calculate personalized daily water intake goals based on your weight and height
- **📈 Statistics & Charts**: View your water intake with visual bar charts (daily, weekly, monthly, yearly)
- **💧 Easy Logging**: Quick-click buttons to log water intake directly from reminders
- **⚙️ Customizable Settings**: Set your own reminder intervals and water amounts
- **💰 Donation Support**: Built-in multi-cryptocurrency donation system with QR codes

## 📋 Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/start` | Start receiving water reminders | `/start` |
| `/stop` | Stop receiving water reminders | `/stop` |
| `/set` | Configure reminder timer and water amount | `/set timer:30 amount:250` |
| `/setbmi` | Set your weight and height for personalized goals | `/setbmi weight:70 height:175` |
| `/add` | Manually log water intake | `/add amount:500` |
| `/stats` | View water intake statistics with charts | `/stats period:week` |
| `/waterintakeinfo` | View your personalized hydration info | `/waterintakeinfo` |
| `/donate` | Support the bot with crypto donations | `/donate` |

### Command Details

- **`/set`**: Timer in minutes (default: 25), amount in milliliters (default: 250)
- **`/setbmi`**: Weight in kilograms, height in centimeters
- **`/stats`**: Period options: `today`, `week`, `month`, `year`

## 🚀 Installation

### Prerequisites

- Node.js 16.x or higher
- MongoDB database
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))

### Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wateryy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your credentials:
   ```env
   BOT_TOKEN=your_discord_bot_token_here
   MONGO_URI=your_mongodb_connection_string_here
   NODE_ENV=production
   TZ=UTC
   ```

4. **Run the bot**
   ```bash
   npm start
   ```

### Docker Setup

1. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

## 🔧 Configuration

### Environment Variables

- `BOT_TOKEN`: Your Discord bot token
- `MONGO_URI`: MongoDB connection string
- `NODE_ENV`: Environment (production/development)
- `TZ`: Timezone (default: UTC)

### Bot Permissions

Required Discord bot permissions:
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Use Slash Commands
- Send DMs to users

### Invite Link

Generate an invite link with the following scopes and permissions:
- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**: 
  - Send Messages
  - Embed Links
  - Attach Files
  - Use Slash Commands

## 📊 How It Works

1. **Set Your Profile**: Use `/setbmi` to enter your weight and height
2. **Configure Reminders**: Use `/set` to customize reminder frequency and water amount
3. **Start Tracking**: Run `/start` to begin receiving reminders
4. **Log Water Intake**: Click "I Drank!" button on reminders or use `/add` manually
5. **View Progress**: Check your stats with `/stats` and get insights with `/waterintakeinfo`

### Daily Water Goal Calculation

The bot calculates your recommended daily water intake using the formula:
```
Daily Goal (ml) = Body Weight (kg) × 33ml
```

This is based on the general recommendation of approximately 33ml of water per kilogram of body weight.

## 🛠️ Tech Stack

- **Discord.js** v14 - Discord bot framework
- **MongoDB** with Mongoose - Data persistence
- **Chart.js** (chartjs-node-canvas) - Statistics visualization
- **QRCode** - Donation QR code generation
- **Docker** - Containerization

## 📁 Project Structure

```
wateryy/
├── bot.js              # Main bot logic
├── package.json        # Dependencies
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose setup
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
└── data/               # Persistent data (Docker volume)
```

## 💰 Donation Support

The bot includes built-in cryptocurrency donation support with QR code generation for:
- Bitcoin (BTC)
- Ethereum (ETH)
- USDT (TRC20 & ERC20)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Solana (SOL)
- Nano (NANO)
- Pepecoin (PEPE)

Users can access donation options via the `/donate` command.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📝 License

ISC

## 🔒 Privacy

- The bot stores user IDs, water intake logs, and BMI information
- All data is stored securely in your MongoDB database
- No data is shared with third parties
- Users can stop tracking at any time with `/stop`

## 🐛 Troubleshooting

### Bot not responding to commands
- Ensure the bot has proper permissions in your server
- Check that slash commands are registered (they may take up to 1 hour to propagate)
- Verify the bot is online and `BOT_TOKEN` is correct

### Reminders not working
- Make sure you've run `/start` to activate reminders
- Check that the bot can send you DMs (enable DMs from server members)
- Verify MongoDB connection is active

### Stats not showing
- Ensure you've logged some water intake with `/add` or reminder buttons
- Check that your MongoDB connection is working properly

## 📧 Support

For issues and questions, please open an issue on the repository.

---

Stay hydrated! 💧
