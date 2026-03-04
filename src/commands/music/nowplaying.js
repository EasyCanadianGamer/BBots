const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, formatDuration } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing song'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }
    const q = getQueue(interaction.guild.id);
    if (!q?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });

    const track = q.current;
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('▶️ Now Playing')
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        { name: 'Duration', value: formatDuration(track.duration), inline: true },
        { name: 'Loop', value: q.loop ? 'ON' : 'OFF', inline: true },
        { name: 'Queue', value: `${q.tracks.length} track(s)`, inline: true }
      )
      .setThumbnail(track.thumbnail);

    return interaction.reply({ embeds: [embed] });
  },
};
