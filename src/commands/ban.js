const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban or unban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Ban a user from the server')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to ban').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the ban').setRequired(false).setMaxLength(512)
        )
        .addIntegerOption(opt =>
          opt.setName('delete_days').setDescription('Days of messages to delete (0–7)').setMinValue(0).setMaxValue(7).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Unban a user by their ID')
        .addStringOption(opt =>
          opt.setName('user_id').setDescription('ID of the user to unban').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the unban').setRequired(false).setMaxLength(512)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');
      const reason     = interaction.options.getString('reason') ?? 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
      const botMember  = interaction.guild.members.me;

      if (targetUser.id === interaction.client.user.id) {
        return interaction.reply({ content: "I can't ban myself.", ephemeral: true });
      }
      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: "You can't ban yourself.", ephemeral: true });
      }

      // Hierarchy check (target may already be banned / not in guild — that's ok)
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (member) {
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          return interaction.reply({ content: `I can't ban **${targetUser.tag}** — their role is equal to or above mine.`, ephemeral: true });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          return interaction.reply({ content: `You can't ban **${targetUser.tag}** — their role is equal to or above yours.`, ephemeral: true });
        }

        // DM before banning
        try {
          await targetUser.send({
            embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle(`You have been banned from ${interaction.guild.name}`)
              .addFields({ name: 'Reason', value: reason })
              .setTimestamp()],
          });
        } catch { /* DMs closed — ignore */ }
      }

      await interaction.guild.bans.create(targetUser.id, {
        reason,
        deleteMessageSeconds: deleteDays * 86400,
      });

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('User Banned')
          .setDescription(`**${targetUser.tag}** has been banned.`)
          .addFields({ name: 'Reason', value: reason })
          .setFooter({ text: `Banned by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });

    } else if (sub === 'remove') {
      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      try {
        await interaction.guild.bans.remove(userId, reason);
      } catch {
        return interaction.reply({ content: 'Could not unban that user — they may not be banned or the ID is invalid.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('User Unbanned')
          .setDescription(`User \`${userId}\` has been unbanned.`)
          .addFields({ name: 'Reason', value: reason })
          .setFooter({ text: `Unbanned by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};
