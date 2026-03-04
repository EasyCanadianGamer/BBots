const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,          // Privileged — enable in Developer Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,        // Privileged — needed for auto-responder & XP
    GatewayIntentBits.GuildMessageReactions, // Required for reaction roles
    GatewayIntentBits.GuildVoiceStates,      // Required for music
    GatewayIntentBits.GuildModeration,       // Required for ban/unban events
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

module.exports = client;
