# BBots 🤖
### aka BootyBots — because why not

A Discord bot built with [discord.js v14](https://discord.js.org/) featuring slash commands for announcements, welcome messages, and role management.

---

## Features

| Command | Description | Required Permission |
| --- | --- | --- |
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
DISCORD_TOKEN=          # Your bot token from the Developer Portal
CLIENT_ID=              # Your bot's Application ID
SESSION_SECRET=         # Random secret for session cookies

# Dashboard OAuth2 (see Admin Dashboard section below for setup)
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Optional — auto-detected via OAuth2 if omitted
GUILD_ID=

# Optional — can be set from the dashboard Settings page instead
WELCOME_CHANNEL_ID=
```

**How to get these values:**
- `DISCORD_TOKEN` — Bot page → Reset Token
- `CLIENT_ID` — General Information → Application ID
- `SESSION_SECRET` — Any long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DISCORD_CLIENT_SECRET` — See the **Discord OAuth2 Setup** section below
- `WELCOME_CHANNEL_ID` — Optional; if left blank, set it from the dashboard Settings page after logging in

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

## Admin Dashboard

When `npm start` runs, the bot also starts a web-based admin panel at `http://localhost:3000` (or whatever port you set).

### Discord OAuth2 Setup (recommended)

OAuth2 lets you log in with your Discord account. The dashboard will auto-detect which guild the bot is in — no need to manually set `GUILD_ID`.

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → your app → **OAuth2**
2. Under **Redirects**, click **Add Redirect** and enter: `http://localhost:3000/auth/discord/callback`
3. Copy the **Client Secret** and add it to your `.env`:

   ```env
   DISCORD_CLIENT_SECRET=your-client-secret-here
   DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
   ```

4. `GUILD_ID` is now optional — if omitted, the dashboard auto-detects it via OAuth2. If set, it's used as a fixed guild.

### Accessing it

1. Open `http://localhost:3000` in your browser
2. Click **Login with Discord** and authorize the app
3. If the bot is in multiple servers you manage, you'll be prompted to pick one
4. Use the sidebar to navigate between sections

### Dashboard sections

| Section | What it does |
| --- | --- |
| **Stats** | Live bot status, uptime, server name, member count, loaded command count |
| **Announce** | Post a formatted embed announcement to any text channel |
| **Welcome** | Manually send a welcome message to a user by their Discord User ID |
| **Roles** | Add or remove roles from a user by User ID |
| **Logs** | Live activity feed — member joins, commands used, dashboard actions. Auto-refreshes every 5s |
| **Settings** | Update the welcome channel ID at runtime (no restart needed) |

> Sessions last 8 hours. The dashboard is local-only by default — do not expose it to the internet without adding HTTPS + a proper auth layer.

---

## Project Structure

```
BBots/
├── src/
│   ├── commands/
│   │   ├── announce.js         # /announce command
│   │   ├── role.js             # /role add & /role remove commands
│   │   └── welcome.js          # /welcome command
│   ├── events/
│   │   ├── guildMemberAdd.js   # Auto welcome on member join
│   │   ├── interactionCreate.js # Slash command handler
│   │   └── ready.js            # Bot ready event
│   ├── web/
│   │   ├── server.js           # Express app setup
│   │   ├── auth.js             # Login/logout + session middleware
│   │   ├── routes.js           # Dashboard page + API endpoints
│   │   └── public/
│   │       ├── index.html      # Dashboard UI
│   │       └── style.css       # Dashboard styles
│   ├── client.js           # Shared Discord client instance
│   ├── config.js           # Reads env vars
│   ├── logger.js           # In-memory activity log buffer
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

- [x] **Moderation commands** — `/kick`, `/ban`, `/mute`, `/warn` with logging
- [x] **Polls** — `/poll` command with reaction-based or button voting
- [x] **Birthday announcements** — let the bot wish members a happy birthday
- [x] **Logging** — audit log channel for role changes, joins, leaves, bans
- [ ] **XP & leveling system** — earn XP for activity, level-up announcements
- [ ] **Custom auto-responders** — trigger bot responses on keywords
- [ ] **Scheduled announcements** — set an announcement to post at a future time
- [ ] **Self-assignable roles** — button menus for users to pick their own roles
- [ ] **Multi-guild support** — per-server config stored in a database (e.g. SQLite or MongoDB)
- [ ] **Music playback** — play/pause/skip/queue from YouTube or Spotify
- [ ] **Notifications** — twitch, youtube, x, instagram, github, custom rss, etc
- [ ] **AI** — idk ai integration or ai bots

---

## License

Do whatever you want with it. It's BootyBots. Have fun.
