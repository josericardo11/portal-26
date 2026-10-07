// POST /api/signup
// Validates the form, sends it to the Google Apps Script web app (stores it in the
// Sheet and sends the welcome email from Gmail), then records stage 6 `welcome_email_sent`.
const { capture } = require('./_posthog');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLES = {
  cno: 'Chief Nursing Officer',
  director_nursing_ops: 'Director of Nursing Operations',
  staffing_manager: 'Staffing / Resource Office Manager',
  float_pool_manager: 'Float Pool Manager',
  other: 'Other'
};
const BEDS = ['under_100', '100_400', 'over_400'];
function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function parse(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body || {};
}

async function toAppsScript(lead) {
  const r = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, secret: process.env.APPS_SCRIPT_SECRET || '' }),
    redirect: 'follow',
    signal: AbortSignal.timeout(10000)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.ok) throw new Error(`apps script ${r.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return 'apps_script';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = parse(req.body);

  // Honeypot: bots fill the hidden field. Pretend success, do nothing.
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });

  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  const lead = {
    name: clean(body.name, 120),
    email: clean(body.email, 200).toLowerCase(),
    title: clean(body.title, 40),
    hospital: clean(body.hospital, 160),
    beds: clean(body.beds, 20),
    pricing_variant: clean(body.pricing_variant, 20),
    utm_source: clean(utm.utm_source, 100),
    utm_medium: clean(utm.utm_medium, 100),
    utm_campaign: clean(utm.utm_campaign, 100),
    signed_up_at: new Date().toISOString()
  };

  if (!lead.name || !EMAIL_RE.test(lead.email) || !TITLES[lead.title] ||
      !lead.hospital || !BEDS.includes(lead.beds) || body.consent !== true) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  let channel = null;
  try {
    if (process.env.APPS_SCRIPT_URL) channel = await toAppsScript(lead);
  } catch (err) {
    console.error('signup delivery failed', err.message);
    return res.status(502).json({ ok: false, error: 'delivery_failed' });
  }

  if (!channel) {
    // Nothing configured yet (pre-launch / local). Log so the lead isn't silently lost.
    console.warn('signup received but no email channel configured', JSON.stringify(lead));
    return res.status(200).json({ ok: true, delivered: false });
  }

  await capture('welcome_email_sent', lead.email, {
    channel,
    pricing_variant: lead.pricing_variant,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign
  });

  return res.status(200).json({ ok: true, delivered: true });
};
