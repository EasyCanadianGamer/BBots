const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const VALID_URL = /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Customize your profile banner shown in /xp')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set your profile banner image')
      .addStringOption(opt => opt
        .setName('url')
        .setDescription('Direct image URL (png, jpg, gif, webp)')
        .setRequired(true)
      )
    )
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Remove your profile banner')
    )
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription("View your or another user's banner")
      .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const url = interaction.options.getString('url');
      if (!VALID_URL.test(url)) {
        return interaction.reply({
          content: '❌ Please provide a direct image URL ending in `.png`, `.jpg`, `.gif`, or `.webp`.',
          ephemeral: true,
        });
      }
      db.db.prepare(
        'INSERT OR REPLACE INTO user_profiles (user_id, banner_url) VALUES (?, ?)'
      ).run(interaction.user.id, url);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription('✅ Banner updated! It will now appear in `/xp`.')
        .setImage(url);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      db.db.prepare(
        'INSERT OR REPLACE INTO user_profiles (user_id, banner_url) VALUES (?, NULL)'
      ).run(interaction.user.id);
      return interaction.reply({ content: '🗑️ Banner cleared.', ephemeral: true });
    }

    if (sub === 'view') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const profile = db.db
        .prepare('SELECT banner_url FROM user_profiles WHERE user_id = ?')
        .get(target.id);

      if (!profile?.banner_url) {
        return interaction.reply({
          content: `**${target.username}** has no banner set. Use \`/banner set\` to add one.`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${target.username}'s Banner`)
        .setImage(profile.banner_url);
      return interaction.reply({ embeds: [embed] });
    }
  },
};
