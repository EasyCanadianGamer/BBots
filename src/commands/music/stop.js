const { SlashCommandBuilder } = require('discord.js');
const { stop, getQueue } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and disconnect the bot'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    stop(interaction.guild.id);
    return interaction.reply({ content: '⏹️ Stopped and disconnected.' });
  },
};
