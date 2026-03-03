require('dotenv').config();

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'WELCOME_CHANNEL_ID'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
};
