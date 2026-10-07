// GET /api/open?e={{email}}  — 1x1 tracking pixel for the welcome email.
// Records funnel stage 7 `welcome_email_opened`, then returns a transparent GIF.
const { capture } = require('./_posthog');

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  const email = String((req.query && req.query.e) || '').trim().toLowerCase();
  const step = String((req.query && req.query.s) || 'welcome').slice(0, 40);

  if (EMAIL_RE.test(email)) {
    await capture('welcome_email_opened', email, {
      email_step: step,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 200)
    });
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(200).send(GIF);
};
