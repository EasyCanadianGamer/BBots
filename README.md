# BBots 🤖
### aka BootyBots — because why not

A Discord bot built with [discord.js v14](https://discord.js.org/) featuring slash commands for announcements, welcome messages, and role management.

---

## Features

| Command | Description | Required Permission |
|---|---|---|
| `/announce` | Post a formatted event announcement embed to any channel | Manage Messages |
| `/welcome` | Manually send a welcome embed for a user to the welcome channel | Manage Guild |
| `/role add` | Add a role to a user | Manage Roles |
| `/role remove` | Remove a role from a user | Manage Roles |

New members also get an automatic welcome message when they join the server (via the `guildMemberAdd` event).

---

## Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A Discord bot application ([Discord Developer Portal](https://discord.com/developers/applications))

### 2. Enable Privileged Intents
In the Discord Developer Portal, go to your bot's **Bot** page and enable:
- **Server Members Intent** (required for `guildMemberAdd` and role management)

### 3. Clone & Install

```bash
git clone <your-repo-url>
cd BBots
npm install
```

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=        # Your bot token from the Developer Portal
CLIENT_ID=            # Your bot's Application ID
GUILD_ID=             # The ID of your Discord server
WELCOME_CHANNEL_ID=   # The channel ID where welcome messages are sent
```

**How to get these values:**
- `DISCORD_TOKEN` — Bot page → Reset Token
- `CLIENT_ID` — General Information → Application ID
- `GUILD_ID` — Right-click your server in Discord → Copy Server ID (enable Developer Mode in settings first)
- `WELCOME_CHANNEL_ID` — Right-click the channel → Copy Channel ID

### 5. Deploy Slash Commands

This registers the slash commands to your guild:

```bash
npm run deploy
```

### 6. Start the Bot

```bash
npm start
```

---

## Project Structure

```
BBots/
├── src/
│   ├── commands/
│   │   ├── announce.js     # /announce command
│   │   ├── role.js         # /role add & /role remove commands
│   │   └── welcome.js      # /welcome command
│   ├── events/
│   │   ├── guildMemberAdd.js   # Auto welcome on member join
│   │   ├── interactionCreate.js # Slash command handler
│   │   └── ready.js            # Bot ready event
│   ├── config.js           # Reads env vars
│   └── index.js            # Entry point
├── deploy-commands.js      # Registers slash commands with Discord
├── .env.example            # Template for environment variables
└── package.json
```

---

## Adding New Commands

1. Create a new file in `src/commands/`, e.g. `src/commands/ping.js`
2. Export a `data` (SlashCommandBuilder) and an `execute(interaction)` function:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
```

3. Run `npm run deploy` to register the new command with Discord.

---

## Future Plans

- [ ] **Music playback** — play/pause/skip/queue from YouTube or Spotify
- [ ] **Moderation commands** — `/kick`, `/ban`, `/mute`, `/warn` with logging
- [ ] **XP & leveling system** — earn XP for activity, level-up announcements
- [ ] **Custom auto-responders** — trigger bot responses on keywords
- [ ] **Polls** — `/poll` command with reaction-based or button voting
- [ ] **Scheduled announcements** — set an announcement to post at a future time
- [ ] **Logging** — audit log channel for role changes, joins, leaves, bans
- [ ] **Self-assignable roles** — button menus for users to pick their own roles
- [ ] **Birthday announcements** — let the bot wish members a happy birthday
- [ ] **Multi-guild support** — per-server config stored in a database (e.g. SQLite or MongoDB)

---

## License

Do whatever you want with it. It's BootyBots. Have fun.
