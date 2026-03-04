const { SlashCommandBuilder } = require('discord.js');
const { skip, getQueue } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    const title = q.current.title;
    skip(interaction.guild.id);
    return interaction.reply({ content: `⏭️ Skipped **${title}**.` });
  },
};
