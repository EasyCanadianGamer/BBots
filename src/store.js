// Backward-compat shim — all logic now lives in src/db.js
const { get, set } = require('./db.js');
module.exports = { get, set };
