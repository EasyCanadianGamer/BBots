const fs = require('node:fs');
const path = require('node:path');
const { Events } = require('discord.js');
const client = require('./client.js');
const { token } = require('./config.js');
const { startDashboard } = require('./web/server.js');

// Load commands (recursively, supports subdirectories like commands/music/)
function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      loadCommands(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.js')) {
      const command = require(path.join(dir, entry.name));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`[WARNING] ${entry.name} is missing 'data' or 'execute'.`);
      }
    }
  }
}
loadCommands(path.join(__dirname, 'commands'));

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.once(Events.ClientReady, () => {
  startDashboard(client);
  require('./scheduler.js').init(client);
  require('./notifications.js').init(client);
});

client.login(token);
