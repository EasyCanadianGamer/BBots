const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { sessionSecret, dashboardPort } = require('../config.js');
const { setupAuth } = require('./auth.js');
const { setupRoutes } = require('./routes.js');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }, // 8 hours
}));

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

let _client = null;

function getClient() {
  return _client;
}

function startDashboard(client) {
  _client = client;
  setupAuth(app, getClient);
  setupRoutes(app, getClient);
  app.listen(dashboardPort, () => {
    console.log(`[DASHBOARD] Admin panel running at http://localhost:${dashboardPort}`);
  });
}

module.exports = { startDashboard };
