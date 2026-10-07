// Portal analytics: PostHog init, UTM capture, A/B variant resolution, event helper.
// Exposes window.Portal = { track, identify, onVariant, variant, utm, distinctId }.
(function () {
  var cfg = window.PORTAL_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var VARIANTS = ['control', 'per-shift'];

  // Strip an email passed in from a welcome-email link before anything records the URL.
  var linkedEmail = params.get('e');
  if (linkedEmail) {
    params.delete('e');
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  // UTMs: keep the first set seen this session so every later event carries them.
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var utm = {};
  UTM_KEYS.forEach(function (k) { if (params.get(k)) utm[k] = params.get(k); });
  try {
    if (Object.keys(utm).length) sessionStorage.setItem('portal_utm', JSON.stringify(utm));
    else utm = JSON.parse(sessionStorage.getItem('portal_utm') || '{}');
  } catch (e) { /* storage blocked: use URL values only */ }

  var enabled = !!cfg.posthogKey;
  if (enabled) {
    // Official PostHog loader snippet.
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    window.posthog.init(cfg.posthogKey, {
      api_host: cfg.posthogHost || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      session_recording: { maskAllInputs: true }
    });
    if (Object.keys(utm).length) window.posthog.register(utm);
  }

  var Portal = {
    utm: utm,
    variant: null,
    variantSource: null,
    events: [], // local log, handy for QA in the console

    track: function (event, props) {
      var p = Object.assign({}, utm, props || {});
      if (Portal.variant) {
        p.pricing_variant = Portal.variant;
        p.variant_source = Portal.variantSource;
      }
      Portal.events.push({ event: event, properties: p });
      if (enabled) window.posthog.capture(event, p);
      else console.info('[portal]', event, p);
    },

    identify: function (email, personProps) {
      if (enabled) window.posthog.identify(email, personProps || {});
    },

    distinctId: function () {
      return enabled && window.posthog.get_distinct_id ? window.posthog.get_distinct_id() : null;
    },

    // Resolves the pricing variant once: flag value, QA override, or control fallback.
    onVariant: function (cb) {
      var done = false;
      function settle(v, source) {
        if (done) return;
        done = true;
        Portal.variant = v;
        Portal.variantSource = source;
        cb(v, source);
      }

      var forced = params.get('variant');
      if (VARIANTS.indexOf(forced) !== -1) return settle(forced, 'qa_override');
      if (!enabled) return settle('control', 'fallback');

      setTimeout(function () { settle('control', 'fallback'); }, cfg.flagTimeoutMs || 1500);
      window.posthog.onFeatureFlags(function () {
        var v = window.posthog.getFeatureFlag(cfg.flagKey || 'pricing-model-test');
        settle(VARIANTS.indexOf(v) !== -1 ? v : 'control', VARIANTS.indexOf(v) !== -1 ? 'flag' : 'fallback');
      });
    }
  };

  if (linkedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedEmail)) Portal.identify(linkedEmail);

  window.Portal = Portal;
})();
