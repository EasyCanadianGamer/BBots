const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, formatDuration } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q?.tracks.length) return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });

    const lines = q.tracks.slice(0, 10).map((t, i) =>
      `${i === 0 ? '▶️' : `${i + 1}.`} [${t.title}](${t.url}) — ${formatDuration(t.duration)}`
    );
    if (q.tracks.length > 10) lines.push(`...and ${q.tracks.length - 10} more`);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Music Queue')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${q.tracks.length} track(s) | Loop: ${q.loop ? 'ON' : 'OFF'}` });

    return interaction.reply({ embeds: [embed] });
  },
};
