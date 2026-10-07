// Server-side PostHog capture. Never throws: analytics must not break signup.
const HOST = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');

async function capture(event, distinctId, properties = {}) {
  const key = process.env.POSTHOG_KEY;
  if (!key || !distinctId) return false;
  try {
    const r = await fetch(`${HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { $lib: 'portal-server', ...properties },
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(3000)
    });
    return r.ok;
  } catch (err) {
    console.error('posthog capture failed', event, err.message);
    return false;
  }
}

module.exports = { capture };
