// Shared mutable runtime settings.
// Initialized from .env values; can be updated at runtime via the dashboard.

const config = require('./config.js');

let _welcomeChannelId = config.welcomeChannelId ?? null;

function getWelcomeChannelId() {
  return _welcomeChannelId;
}

function setWelcomeChannelId(id) {
  _welcomeChannelId = id || null;
}

module.exports = { getWelcomeChannelId, setWelcomeChannelId };
