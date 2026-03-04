const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const db = require('./db.js');

let _client = null;
let _twitchToken = null;
let _twitchTokenExpiry = 0;

function init(client) {
  _client = client;
  // Poll every 5 minutes
  cron.schedule('*/5 * * * *', () => poll().catch(console.error));
}

async function poll() {
  const feeds = db.db.prepare('SELECT * FROM notification_feeds').all();

  for (const feed of feeds) {
    if (!db.isEnabled(feed.guild_id, 'notifications')) continue;
    try {
      if (feed.type === 'twitch')  await checkTwitch(feed);
      if (feed.type === 'youtube') await checkYouTube(feed);
      if (feed.type === 'rss')     await checkRSS(feed);
    } catch (err) {
      console.error(`[Notifications] Error checking ${feed.type}/${feed.source}:`, err.message);
    }
  }
}

// ── Twitch ────────────────────────────────────────────────────────────────────

async function getTwitchToken() {
  if (_twitchToken && Date.now() < _twitchTokenExpiry) return _twitchToken;
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  _twitchToken = data.access_token;
  _twitchTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _twitchToken;
}

async function checkTwitch(feed) {
  const { TWITCH_CLIENT_ID } = process.env;
  if (!TWITCH_CLIENT_ID) return;
  const token = await getTwitchToken();
  if (!token) return;

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(feed.source)}`,
    { headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` } }
  );
  const data = await res.json();
  const stream = data.data?.[0];
  if (!stream) return; // offline

  if (feed.last_seen === stream.id) return; // already notified
  db.db.prepare('UPDATE notification_feeds SET last_seen = ? WHERE id = ?').run(stream.id, feed.id);

  const channel = _client?.channels.cache.get(feed.channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x9146FF)
    .setTitle(`${stream.user_name} is live on Twitch!`)
    .setDescription(stream.title)
    .addFields(
      { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
      { name: 'Viewers', value: stream.viewer_count.toLocaleString(), inline: true }
    )
    .setURL(`https://twitch.tv/${feed.source}`)
    .setTimestamp();

  const content = feed.role_ping ? `<@&${feed.role_ping}>` : undefined;
  await channel.send({ content, embeds: [embed] }).catch(() => null);
}

// ── YouTube ───────────────────────────────────────────────────────────────────

async function checkYouTube(feed) {
  const { YOUTUBE_API_KEY } = process.env;
  if (!YOUTUBE_API_KEY) return;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${encodeURIComponent(feed.source)}&order=date&maxResults=1&part=snippet&type=video&key=${YOUTUBE_API_KEY}`
  );
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return;

  const videoId = item.id?.videoId;
  if (!videoId || feed.last_seen === videoId) return;
  db.db.prepare('UPDATE notification_feeds SET last_seen = ? WHERE id = ?').run(videoId, feed.id);

  const channel = _client?.channels.cache.get(feed.channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(item.snippet.title)
    .setDescription(`New video from **${item.snippet.channelTitle}**`)
    .setURL(`https://www.youtube.com/watch?v=${videoId}`)
    .setThumbnail(item.snippet.thumbnails?.default?.url)
    .setTimestamp(new Date(item.snippet.publishedAt));

  const content = feed.role_ping ? `<@&${feed.role_ping}>` : undefined;
  await channel.send({ content, embeds: [embed] }).catch(() => null);
}

// ── RSS ───────────────────────────────────────────────────────────────────────

async function checkRSS(feed) {
  const Parser = require('rss-parser');
  const parser = new Parser();
  const parsedFeed = await parser.parseURL(feed.source);
  const item = parsedFeed.items?.[0];
  if (!item) return;

  const guid = item.guid || item.link;
  if (!guid || feed.last_seen === guid) return;
  db.db.prepare('UPDATE notification_feeds SET last_seen = ? WHERE id = ?').run(guid, feed.id);

  const channel = _client?.channels.cache.get(feed.channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xFF6600)
    .setTitle(item.title || 'New post')
    .setDescription(item.contentSnippet?.slice(0, 300) || '')
    .setURL(item.link)
    .setTimestamp(item.pubDate ? new Date(item.pubDate) : undefined);

  const content = feed.role_ping ? `<@&${feed.role_ping}>` : undefined;
  await channel.send({ content, embeds: [embed] }).catch(() => null);
}

module.exports = { init };
