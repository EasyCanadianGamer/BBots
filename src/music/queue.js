const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const ytdlp = require('yt-dlp-exec');

// Register ffmpeg-static path so @discordjs/voice can find ffmpeg
try {
  process.env.FFMPEG_PATH = require('ffmpeg-static');
} catch { /* ffmpeg-static not installed, fall back to system ffmpeg */ }

// Map<guildId, GuildQueue>
const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId) ?? null;
}

async function resolveTrack(query) {
  // Resolve URL or search term → track info via yt-dlp
  const isUrl = /^https?:\/\//.test(query);
  const url = isUrl ? query : `ytsearch1:${query}`;

  const info = await ytdlp(url, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noPlaylist: true,
    format: 'bestaudio[ext=webm]/bestaudio',
    quiet: true,
  });

  // yt-dlp returns a result or a search result wrapper
  const entry = info.entries?.[0] ?? info;
  return {
    title:     entry.title,
    url:       entry.webpage_url ?? entry.url,
    duration:  entry.duration ?? 0,
    thumbnail: entry.thumbnail ?? null,
    requestedBy: null, // set by caller
  };
}

async function createResource(track) {
  const stream = ytdlp.exec(track.url, {
    format: 'bestaudio',
    noPlaylist: true,
    quiet: true,
    output: '-',
  }, { stdio: ['ignore', 'pipe', 'ignore'] });

  return createAudioResource(stream.stdout, {
    inputType: StreamType.Arbitrary,
    inlineVolume: false,
  });
}

async function play(guildId) {
  const q = queues.get(guildId);
  if (!q || !q.tracks.length) {
    queues.delete(guildId);
    q?.connection?.destroy();
    return;
  }

  const track = q.loop ? q.tracks[0] : q.tracks[0];
  q.current = track;

  try {
    const resource = await createResource(track);
    q.player.play(resource);
  } catch (err) {
    console.error('[Music] Resource error:', err.message);
    if (!q.loop) q.tracks.shift();
    play(guildId);
  }
}

async function enqueue(voiceChannel, _textChannel, track) {
  const guildId = voiceChannel.guild.id;

  if (!queues.has(guildId)) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const q = { connection, player, tracks: [], current: null, loop: false };
    queues.set(guildId, q);

    player.on(AudioPlayerStatus.Idle, () => {
      const queue = queues.get(guildId);
      if (!queue) return;
      if (!queue.loop) queue.tracks.shift();
      play(guildId);
    });

    player.on('error', err => {
      console.error('[Music] Player error:', err.message);
      const queue = queues.get(guildId);
      if (queue && !queue.loop) queue.tracks.shift();
      play(guildId);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        stop(guildId);
      }
    });
  }

  const q = queues.get(guildId);
  q.tracks.push(track);

  if (q.tracks.length === 1) {
    await play(guildId);
  }

  return q;
}

function skip(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  q.loop = false;
  q.player.stop(true);
  return true;
}

function stop(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  q.tracks = [];
  q.loop = false;
  q.player.stop(true);
  q.connection.destroy();
  queues.delete(guildId);
  return true;
}

function toggleLoop(guildId) {
  const q = queues.get(guildId);
  if (!q) return null;
  q.loop = !q.loop;
  return q.loop;
}

function formatDuration(seconds) {
  if (!seconds) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = { getQueue, enqueue, resolveTrack, skip, stop, toggleLoop, formatDuration };
