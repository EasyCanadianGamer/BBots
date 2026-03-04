const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const MAX_MINUTES = 40320; // 28 days — Discord's timeout limit

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout or un-timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Timeout a member for a set duration')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to timeout').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('duration').setDescription('Duration in minutes (max 40320 = 28 days)').setMinValue(1).setMaxValue(MAX_MINUTES).setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the timeout').setRequired(false).setMaxLength(512)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove an active timeout from a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to un-timeout').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for removing the timeout').setRequired(false).setMaxLength(512)
        )
    ),

  async execute(interaction) {
    const sub        = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const reason     = interaction.options.getString('reason') ?? 'No reason provided';
    const botMember  = interaction.guild.members.me;

    if (targetUser.id === interaction.client.user.id) {
      return interaction.reply({ content: "I can't timeout myself.", ephemeral: true });
    }

    let member;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }

    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: `I can't timeout **${targetUser.tag}** — their role is equal to or above mine.`, ephemeral: true });
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: `You can't timeout **${targetUser.tag}** — their role is equal to or above yours.`, ephemeral: true });
    }

    if (sub === 'add') {
      const duration = interaction.options.getInteger('duration');
      const durationMs = duration * 60_000;

      // Format duration for display
      const d = Math.floor(duration / 1440);
      const h = Math.floor((duration % 1440) / 60);
      const m = duration % 60;
      const durationStr = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');

      try {
        await targetUser.send({
          embeds: [new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`You have been timed out in ${interaction.guild.name}`)
            .addFields(
              { name: 'Duration', value: durationStr },
              { name: 'Reason', value: reason }
            )
            .setTimestamp()],
        });
      } catch { /* DMs closed — ignore */ }

      await member.timeout(durationMs, reason);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('Member Timed Out')
          .setDescription(`**${targetUser.tag}** has been timed out for **${durationStr}**.`)
          .addFields({ name: 'Reason', value: reason })
          .setFooter({ text: `Timed out by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });

    } else if (sub === 'remove') {
      if (!member.isCommunicationDisabled()) {
        return interaction.reply({ content: `**${targetUser.tag}** is not currently timed out.`, ephemeral: true });
      }

      await member.timeout(null, reason);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('Timeout Removed')
          .setDescription(`**${targetUser.tag}**'s timeout has been removed.`)
          .addFields({ name: 'Reason', value: reason })
          .setFooter({ text: `Removed by ${interaction.user.tag}` })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};
