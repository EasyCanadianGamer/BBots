// Per-channel conversation history (in-memory, resets on restart)
// Map<channelId, Array<{role, content}>>
const histories = new Map();
const MAX_HISTORY = 20; // 10 exchanges

const PROVIDER_DEFAULTS = {
  xai:    { baseUrl: 'https://api.x.ai/v1',          model: 'grok-beta' },
  openai: { baseUrl: 'https://api.openai.com/v1',     model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434/v1',      model: 'llama3.2' },
};

function getApiKey(provider) {
  if (provider === 'xai')    return process.env.XAI_API_KEY;
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  return 'ollama'; // Ollama doesn't require a real key
}

function getBaseUrl(provider) {
  if (provider === 'ollama') {
    const base = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
    return base.endsWith('/v1') ? base : base + '/v1';
  }
  return PROVIDER_DEFAULTS[provider]?.baseUrl ?? PROVIDER_DEFAULTS.openai.baseUrl;
}

/**
 * Send a message to the configured AI provider.
 * @param {string} channelId   Discord channel ID (for history)
 * @param {string} userMessage Text from the user
 * @param {object} settings    { provider, model, systemPrompt }
 * @returns {Promise<string>}  AI response text
 */
async function chat(channelId, userMessage, settings) {
  const provider    = settings.provider ?? 'openai';
  const model       = settings.model    ?? PROVIDER_DEFAULTS[provider]?.model ?? 'gpt-4o-mini';
  const systemPrompt = settings.systemPrompt ?? 'You are a helpful Discord bot assistant.';
  const baseUrl     = getBaseUrl(provider);
  const apiKey      = getApiKey(provider);

  if (!apiKey || apiKey === '') {
    throw new Error(`No API key configured for provider "${provider}". Set the appropriate env var.`);
  }

  // Build history
  if (!histories.has(channelId)) histories.set(channelId, []);
  const history = histories.get(channelId);
  history.push({ role: 'user', content: userMessage });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim() ?? '(no response)';

  // Save assistant reply and trim history
  history.push({ role: 'assistant', content: reply });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  return reply;
}

/** Clear conversation history for a channel */
function clearHistory(channelId) {
  histories.delete(channelId);
}

module.exports = { chat, clearHistory };
