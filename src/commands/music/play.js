const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { enqueue, resolveTrack } = require('../../music/queue.js');
const db = require('../../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(opt => opt.setName('query').setDescription('YouTube URL or search term').setRequired(true)),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'music')) {
      return interaction.reply({ content: 'Music is disabled on this server.', ephemeral: true });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const botVc = interaction.guild.members.me?.voice?.channel;
    if (botVc && botVc.id !== voiceChannel.id) {
      return interaction.reply({ content: '❌ Bot is already in a different voice channel.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const track = await resolveTrack(interaction.options.getString('query'));
      track.requestedBy = interaction.user.id;

      const q = await enqueue(voiceChannel, interaction.channel, track);
      const isFirst = q.tracks.length === 1;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(isFirst ? '▶️ Now Playing' : '➕ Added to Queue')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields({ name: 'Duration', value: require('../../music/queue.js').formatDuration(track.duration), inline: true })
        .setThumbnail(track.thumbnail)
        .setFooter({ text: `Requested by ${interaction.user.username}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Music/play]', err);
      return interaction.editReply({ content: `❌ Could not play that: ${err.message}` });
    }
  },
};
