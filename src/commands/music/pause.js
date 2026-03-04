const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../../music/queue.js');
const { AudioPlayerStatus } = require('@discordjs/voice');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume the current song'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });

    if (q.player.state.status === AudioPlayerStatus.Paused) {
      q.player.unpause();
      return interaction.reply({ content: '▶️ Resumed.' });
    } else {
      q.player.pause();
      return interaction.reply({ content: '⏸️ Paused.' });
    }
  },
};
