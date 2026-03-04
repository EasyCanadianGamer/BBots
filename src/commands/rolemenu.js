const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { randomUUID } = require('node:crypto');
const db = require('../db.js');

async function postOrUpdateMenu(client, menu) {
  const channel = client.channels.cache.get(menu.channel_id);
  if (!channel) return;

  const buttons = db.db
    .prepare('SELECT * FROM role_menu_buttons WHERE menu_id = ?')
    .all(menu.id);

  if (!buttons.length) return;

  // Build rows of up to 5 buttons each
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const slice = buttons.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      slice.map(b => {
        const btn = new ButtonBuilder()
          .setCustomId(`rolemenu:${menu.id}:${b.role_id}`)
          .setLabel(b.label)
          .setStyle(ButtonStyle.Secondary);
        if (b.emoji) btn.setEmoji(b.emoji);
        return btn;
      })
    );
    rows.push(row);
  }

  const payload = { content: `**${menu.title}**`, components: rows };

  if (menu.message_id) {
    try {
      const msg = await channel.messages.fetch(menu.message_id);
      await msg.edit(payload);
      return;
    } catch { /* message deleted — fall through to post new */ }
  }

  const msg = await channel.send(payload);
  db.db.prepare('UPDATE role_menus SET message_id = ? WHERE id = ?').run(msg.id, menu.id);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Manage self-assignable role button menus')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new role menu')
      .addStringOption(opt => opt.setName('title').setDescription('Title shown above the buttons').setRequired(true))
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the menu in').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a button to an existing role menu')
      .addStringOption(opt => opt.setName('menu_id').setDescription('Menu ID (from /rolemenu list)').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
      .addStringOption(opt => opt.setName('label').setDescription('Button label').setRequired(true))
      .addStringOption(opt => opt.setName('emoji').setDescription('Button emoji (optional)'))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all role menus in this server')
    )
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete a role menu')
      .addStringOption(opt => opt.setName('menu_id').setDescription('Menu ID to delete').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const title   = interaction.options.getString('title');
      const channel = interaction.options.getChannel('channel');
      const id = randomUUID();
      db.db.prepare(
        'INSERT INTO role_menus (id, guild_id, channel_id, title) VALUES (?, ?, ?, ?)'
      ).run(id, guildId, channel.id, title);
      return interaction.reply({
        content: `✅ Role menu created! ID: \`${id}\`\nUse \`/rolemenu add menu_id:${id}\` to add buttons.`,
        ephemeral: true,
      });
    }

    if (sub === 'add') {
      const menuId = interaction.options.getString('menu_id');
      const role   = interaction.options.getRole('role');
      const label  = interaction.options.getString('label');
      const emoji  = interaction.options.getString('emoji') ?? null;

      const menu = db.db.prepare('SELECT * FROM role_menus WHERE id = ? AND guild_id = ?').get(menuId, guildId);
      if (!menu) return interaction.reply({ content: '❌ Menu not found.', ephemeral: true });

      const btnCount = db.db.prepare('SELECT COUNT(*) as c FROM role_menu_buttons WHERE menu_id = ?').get(menuId).c;
      if (btnCount >= 25) return interaction.reply({ content: '❌ Maximum 25 buttons per menu.', ephemeral: true });

      db.db.prepare(
        'INSERT INTO role_menu_buttons (id, menu_id, role_id, label, emoji) VALUES (?, ?, ?, ?, ?)'
      ).run(randomUUID(), menuId, role.id, label, emoji);

      await postOrUpdateMenu(interaction.client, menu);
      return interaction.reply({ content: `✅ Button for **${role.name}** added to menu.`, ephemeral: true });
    }

    if (sub === 'list') {
      const menus = db.db.prepare('SELECT * FROM role_menus WHERE guild_id = ?').all(guildId);
      if (!menus.length) return interaction.reply({ content: 'No role menus in this server.', ephemeral: true });
      const lines = menus.map(m => `\`${m.id}\` — **${m.title}** (<#${m.channel_id}>)`);
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    if (sub === 'delete') {
      const menuId = interaction.options.getString('menu_id');
      const menu = db.db.prepare('SELECT * FROM role_menus WHERE id = ? AND guild_id = ?').get(menuId, guildId);
      if (!menu) return interaction.reply({ content: '❌ Menu not found.', ephemeral: true });

      if (menu.message_id) {
        try {
          const ch = interaction.guild.channels.cache.get(menu.channel_id);
          const msg = await ch?.messages.fetch(menu.message_id).catch(() => null);
          if (msg) await msg.delete().catch(() => null);
        } catch { /* ignore */ }
      }

      db.db.prepare('DELETE FROM role_menu_buttons WHERE menu_id = ?').run(menuId);
      db.db.prepare('DELETE FROM role_menus WHERE id = ?').run(menuId);
      return interaction.reply({ content: '✅ Role menu deleted.', ephemeral: true });
    }
  },
};
