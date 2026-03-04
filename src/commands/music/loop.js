const { SlashCommandBuilder } = require('discord.js');
const { toggleLoop, getQueue } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle loop mode for the current song'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    const looping = toggleLoop(interaction.guild.id);
    return interaction.reply({ content: `🔁 Loop is now **${looping ? 'ON' : 'OFF'}**.` });
  },
};
