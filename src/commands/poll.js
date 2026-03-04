const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const store = require('../store.js');

function buildPollEmbed(question, options, votes) {
  const totalVoters = new Set(votes.flat()).size;

  const lines = options.map((opt, i) => {
    const count = votes[i]?.length ?? 0;
    const pct   = totalVoters > 0 ? Math.round(count / totalVoters * 100) : 0;
    const filled = Math.round(pct / 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `**${opt}**\n${bar} ${count} vote${count !== 1 ? 's' : ''} (${pct}%)`;
  });

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📊 ${question}`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${totalVoters} voter${totalVoters !== 1 ? 's' : ''} — click a button to vote` })
    .setTimestamp();
}

function buildPollComponents(messageId, options) {
  const buttons = options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`poll:${messageId}:${i}`)
      .setLabel(opt.length > 80 ? opt.slice(0, 77) + '…' : opt)
      .setStyle(ButtonStyle.Primary)
  );
  return [new ActionRowBuilder().addComponents(buttons)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with up to 4 options')
    .addStringOption(opt =>
      opt.setName('question').setDescription('The poll question').setRequired(true).setMaxLength(256)
    )
    .addStringOption(opt =>
      opt.setName('option1').setDescription('First option').setRequired(true).setMaxLength(80)
    )
    .addStringOption(opt =>
      opt.setName('option2').setDescription('Second option').setRequired(true).setMaxLength(80)
    )
    .addStringOption(opt =>
      opt.setName('option3').setDescription('Third option').setRequired(false).setMaxLength(80)
    )
    .addStringOption(opt =>
      opt.setName('option4').setDescription('Fourth option').setRequired(false).setMaxLength(80)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options  = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
    ].filter(Boolean);

    await interaction.deferReply({ ephemeral: true });

    const votes = options.map(() => []);

    // Post the poll message (use PLACEHOLDER id first, then edit with real id)
    const msg = await interaction.channel.send({
      embeds: [buildPollEmbed(question, options, votes)],
      components: buildPollComponents('PLACEHOLDER', options),
    });

    // Persist poll data
    const polls = store.get('polls') ?? {};
    polls[msg.id] = { question, options, votes, channelId: interaction.channel.id, guildId: interaction.guild.id };
    store.set('polls', polls);

    // Update buttons with the real message ID
    await msg.edit({ components: buildPollComponents(msg.id, options) });

    await interaction.editReply({ content: '✅ Poll created!' });
  },

  // Exported so interactionCreate.js can update poll messages
  buildPollEmbed,
  buildPollComponents,
};
