const MAX_ENTRIES = 100;

const entries = [];

/**
 * Add a log entry.
 * @param {'info'|'join'|'command'|'action'|'warn'} type
 * @param {string} message
 */
function add(type, message) {
  entries.push({ timestamp: new Date().toISOString(), type, message });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/** Returns a copy of all log entries, newest first. */
function getAll() {
  return [...entries].reverse();
}

module.exports = { add, getAll };
