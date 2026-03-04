const crypto = require('node:crypto');
const { clientId, clientSecret, discordRedirectUri } = require('../config.js');

// ── Shared page shell ───────────────────────────────────────────────────────

function pageShell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BBots — ${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e1e2e;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #cdd6f4;
    }
    .card {
      background: #313244;
      border-radius: 12px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .logo { font-size: 2rem; font-weight: 700; text-align: center; margin-bottom: 0.25rem; color: #cba6f7; }
    .subtitle { text-align: center; font-size: 0.85rem; color: #a6adc8; margin-bottom: 2rem; }
    label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.4rem; color: #a6adc8; text-transform: uppercase; letter-spacing: 0.05em; }
    select {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 2px solid #45475a;
      background: #1e1e2e;
      color: #cdd6f4;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
      appearance: none;
    }
    select:focus { border-color: #5865F2; }
    .btn {
      margin-top: 1rem;
      width: 100%;
      padding: 0.7rem;
      border-radius: 8px;
      border: none;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      text-decoration: none;
      color: #fff;
      background: #5865F2;
    }
    .btn:hover { background: #4752c4; }
    .error {
      background: #45182d;
      border: 1px solid #f38ba8;
      color: #f38ba8;
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .form-group { margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BBots 🤖</div>
    <div class="subtitle">aka BootyBots — Admin Panel</div>
    ${body}
  </div>
</body>
</html>`;
}

const DISCORD_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`;

// ── requireAuth middleware ──────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (req.session?.authed) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/login');
}

// ── Discord OAuth2 helpers ──────────────────────────────────────────────────

function buildDiscordAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: discordRedirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordRedirectUri,
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

async function discordGet(path, token) {
  const res = await fetch(`https://discord.com/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Discord API ${path} failed: ${res.status}`);
  return res.json();
}

const MANAGE_GUILD   = 0x20n;
const ADMINISTRATOR  = 0x8n;

// ── setupAuth ───────────────────────────────────────────────────────────────

function setupAuth(app, getClient) {
  // ── Login page ────────────────────────────────────────────────────────────
  app.get('/login', (req, res) => {
    if (req.session?.authed) return res.redirect('/dashboard');
    res.send(pageShell('Login', `
      <a class="btn" href="/auth/discord">
        ${DISCORD_SVG} Login with Discord
      </a>`));
  });

  // ── Discord OAuth2 — initiate ─────────────────────────────────────────────
  app.get('/auth/discord', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    res.redirect(buildDiscordAuthUrl(state));
  });

  // ── Discord OAuth2 — callback ─────────────────────────────────────────────
  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(pageShell('Error', `<div class="error">Discord denied access: ${error}</div><a class="btn" href="/login">Back to Login</a>`));
    }

    if (!code || state !== req.session.oauthState) {
      return res.send(pageShell('Error', `<div class="error">Invalid OAuth2 state. Please try again.</div><a class="btn" href="/login">Back to Login</a>`));
    }

    delete req.session.oauthState;

    try {
      const { access_token } = await exchangeCode(code);

      const [user, userGuilds] = await Promise.all([
        discordGet('/users/@me', access_token),
        discordGet('/users/@me/guilds', access_token),
      ]);

      const client = getClient();
      const botGuildIds = new Set(client.guilds.cache.keys());

      const tag = user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : user.username;

      // Store user info in session now so the picker page can use it
      req.session.discordUser = {
        id: user.id,
        tag,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`,
      };

      // All guilds where the user has at least Manage Server or Administrator
      const manageableGuilds = userGuilds.filter(g => {
        const perms = BigInt(g.permissions ?? '0');
        return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
      });

      // Annotate each guild with whether the bot is already in it
      const annotated = manageableGuilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
        hasBot: botGuildIds.has(g.id),
      }));

      // If GUILD_ID is locked in env, skip the picker
      const configGuildId = process.env.GUILD_ID;
      if (configGuildId) {
        const match = annotated.find(g => g.id === configGuildId && g.hasBot);
        if (!match) {
          return res.send(pageShell('Error', `<div class="error">The bot is not in the configured guild, or you don't have permission there.</div><a class="btn" href="/login">Back to Login</a>`));
        }
        req.session.authed = true;
        req.session.authMethod = 'discord';
        req.session.activeGuildId = configGuildId;
        return res.redirect('/dashboard');
      }

      // If only one guild has the bot, skip the picker
      const botGuilds = annotated.filter(g => g.hasBot);
      if (botGuilds.length === 1 && annotated.length === 1) {
        req.session.authed = true;
        req.session.authMethod = 'discord';
        req.session.activeGuildId = botGuilds[0].id;
        return res.redirect('/dashboard');
      }

      // Show the guild picker (Carl-bot style)
      req.session.pickerGuilds = annotated;
      res.redirect('/auth/pick-guild');

    } catch (err) {
      console.error('[OAUTH2] Callback error:', err);
      res.send(pageShell('Error', `<div class="error">Authentication failed. Please try again.</div><a class="btn" href="/login">Back to Login</a>`));
    }
  });

  // ── Guild picker (Carl-bot style card grid) ───────────────────────────────
  app.get('/auth/pick-guild', (req, res) => {
    const guilds = req.session.pickerGuilds;
    if (!guilds?.length) return res.redirect('/login');

    const addBotUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=8`;

    const cards = guilds.map(g => {
      const initials = g.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const avatar = g.icon
        ? `<img src="${g.icon}" alt="${g.name}">`
        : `<span class="guild-initials">${initials}</span>`;

      if (g.hasBot) {
        return `
          <form method="POST" action="/auth/pick-guild" class="guild-card guild-card--active">
            <input type="hidden" name="guildId" value="${g.id}">
            <div class="guild-icon">${avatar}</div>
            <div class="guild-name">${g.name}</div>
            <button type="submit" class="guild-btn guild-btn--manage">Manage</button>
          </form>`;
      }
      return `
        <div class="guild-card guild-card--inactive">
          <div class="guild-icon">${avatar}</div>
          <div class="guild-name">${g.name}</div>
          <a href="${addBotUrl}&guild_id=${g.id}" class="guild-btn guild-btn--add">Add Bot</a>
        </div>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BBots — Select a Server</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #1e1e2e;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #cdd6f4;
      padding: 2rem 1rem;
    }
    h1 { text-align: center; font-size: 1.5rem; color: #cba6f7; margin-bottom: 0.4rem; }
    .subtitle { text-align: center; color: #a6adc8; font-size: 0.875rem; margin-bottom: 2rem; }
    .guild-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 1rem;
      max-width: 860px;
      margin: 0 auto;
    }
    .guild-card {
      background: #313244;
      border-radius: 12px;
      padding: 1.25rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      border: 2px solid transparent;
      transition: border-color 0.15s;
    }
    .guild-card--active { cursor: pointer; }
    .guild-card--active:hover { border-color: #5865F2; }
    .guild-card--inactive { opacity: 0.6; }
    .guild-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      overflow: hidden;
      background: #45475a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .guild-icon img { width: 100%; height: 100%; object-fit: cover; }
    .guild-initials { font-size: 1.1rem; font-weight: 700; color: #cdd6f4; }
    .guild-name {
      font-size: 0.875rem;
      font-weight: 600;
      text-align: center;
      word-break: break-word;
      color: #cdd6f4;
    }
    .guild-btn {
      margin-top: auto;
      padding: 0.4rem 1rem;
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: opacity 0.15s;
    }
    .guild-btn:hover { opacity: 0.85; }
    .guild-btn--manage { background: #5865F2; color: #fff; width: 100%; }
    .guild-btn--add    { background: #45475a; color: #a6adc8; width: 100%; text-align: center; }
    .back { display: block; text-align: center; margin-top: 1.5rem; color: #a6adc8; font-size: 0.85rem; text-decoration: none; }
    .back:hover { color: #cdd6f4; }
  </style>
</head>
<body>
  <h1>BBots 🤖</h1>
  <p class="subtitle">Select a server to manage</p>
  <div class="guild-grid">${cards}</div>
  <a class="back" href="/logout">← Sign out</a>
</body>
</html>`);
  });

  app.post('/auth/pick-guild', (req, res) => {
    const { guildId } = req.body;
    const guilds = req.session.pickerGuilds;
    const match = guilds?.find(g => g.id === guildId && g.hasBot);
    if (!match) return res.redirect('/auth/pick-guild');
    req.session.authed = true;
    req.session.authMethod = 'discord';
    req.session.activeGuildId = guildId;
    delete req.session.pickerGuilds;
    res.redirect('/dashboard');
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
  });
}

module.exports = { setupAuth, requireAuth };
