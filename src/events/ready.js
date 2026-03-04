const { Events } = require('discord.js');
const logger = require('../logger.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[READY] Logged in as ${client.user.tag}`);
    logger.add('info', `Bot logged in as ${client.user.tag}`);
  },
};
