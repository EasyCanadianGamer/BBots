const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../store.js');

function warnKey(guildId, userId) {
  return `warnings:${guildId}:${userId}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Manage warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Issue a warning to a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to warn').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the warning').setRequired(true).setMaxLength(512)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View warnings for a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to check').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all warnings for a member (requires Manage Guild)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to clear').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub        = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const key        = warnKey(interaction.guild.id, targetUser.id);

    if (sub === 'add') {
      const reason   = interaction.options.getString('reason');
      const warnings = store.get(key) ?? [];

      warnings.push({
        reason,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        timestamp: new Date().toISOString(),
      });
      store.set(key, warnings);

      // DM the user
      try {
        await targetUser.send({
          embeds: [new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`You received a warning in ${interaction.guild.name}`)
            .addFields(
              { name: 'Reason', value: reason },
              { name: 'Total Warnings', value: String(warnings.length) }
            )
            .setTimestamp()],
        });
      } catch { /* DMs closed — ignore */ }

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('Warning Issued')
          .setDescription(`**${targetUser.tag}** has been warned.`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Total Warnings', value: String(warnings.length) }
          )
          .setFooter({ text: `Warned by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });

    } else if (sub === 'list') {
      const warnings = store.get(key) ?? [];

      if (!warnings.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`Warnings for ${targetUser.tag}`)
            .setDescription('No warnings on record.')],
          ephemeral: true,
        });
      }

      // Show last 10, newest first
      const recent = [...warnings].reverse().slice(0, 10);
      const fields = recent.map((w, i) => ({
        name: `#${warnings.length - i} — ${new Date(w.timestamp).toLocaleDateString()}`,
        value: `${w.reason}\n*by ${w.moderatorTag}*`,
      }));

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`Warnings for ${targetUser.tag}`)
          .setDescription(`**${warnings.length}** total warning(s)${warnings.length > 10 ? ' (showing last 10)' : ''}`)
          .addFields(fields)
          .setTimestamp()],
        ephemeral: true,
      });

    } else if (sub === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'Clearing warnings requires the **Manage Server** permission.', ephemeral: true });
      }

      const warnings = store.get(key) ?? [];
      if (!warnings.length) {
        return interaction.reply({ content: `**${targetUser.tag}** has no warnings to clear.`, ephemeral: true });
      }

      store.set(key, []);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('Warnings Cleared')
          .setDescription(`Cleared **${warnings.length}** warning(s) for **${targetUser.tag}**.`)
          .setFooter({ text: `Cleared by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};
