require('dotenv').config();

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'SESSION_SECRET', 'DISCORD_CLIENT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID ?? null,                  // optional — auto-discovered via OAuth2 if absent
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID ?? null,  // optional — set via dashboard if absent
  dashboardPort: parseInt(process.env.DASHBOARD_PORT ?? '3000', 10),
  sessionSecret: process.env.SESSION_SECRET,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:3000/auth/discord/callback',
};
