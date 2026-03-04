const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
}

const commands = [];

function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      loadCommands(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.js')) {
      const command = require(path.join(dir, entry.name));
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        console.warn(`[WARNING] Skipping ${entry.name}: missing 'data' or 'execute'.`);
      }
    }
  }
}
loadCommands(path.join(__dirname, 'src', 'commands'));

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash command(s) to guild ${GUILD_ID}...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`Successfully registered ${data.length} command(s).`);
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
})();
