// Landing page behavior: variant reveal, funnel events 1–5, signup and feedback forms.
(function () {
  var P = window.Portal;
  var form = document.getElementById('signup-form');

  // Stage 1 waits for the variant so the event carries it.
  P.onVariant(function (variant) {
    document.body.setAttribute('data-variant', variant);
    P.track('landing_page_viewed');
    watchPricing();
  });

  // Stage 2: pricing block at least half in view, once.
  function watchPricing() {
    var el = document.querySelector('[data-show-for="' + P.variant + '"]');
    if (!el || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        P.track('pricing_section_viewed');
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
  }

  // Stage 3: any main CTA.
  document.querySelectorAll('[data-cta]').forEach(function (a) {
    a.addEventListener('click', function () {
      P.track('signup_cta_clicked', { cta_location: a.getAttribute('data-cta') });
    });
  });

  // Stage 4: first field focused, once.
  var started = false;
  form.addEventListener('focusin', function (e) {
    if (started || e.target.name === 'website' || !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    started = true;
    P.track('signup_form_started');
  });

  // Stage 5: submitted and accepted by the server.
  var errorEl = document.getElementById('form-error');
  var submitBtn = document.getElementById('submit-btn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function validate(data) {
    if (!data.name.trim()) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return 'Please enter a valid work email.';
    if (!data.title) return 'Please choose your role.';
    if (!data.hospital.trim()) return 'Please enter your hospital.';
    if (!data.beds) return 'Please choose a bed range.';
    if (!data.consent) return 'Please agree to receive emails so we can send the welcome note.';
    return '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var data = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      title: fd.get('title') || '',
      hospital: fd.get('hospital') || '',
      beds: fd.get('beds') || '',
      website: fd.get('website') || '',
      consent: fd.get('consent') === 'on'
    };
    var err = validate(data);
    showError(err);
    if (err) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, data, {
        pricing_variant: P.variant,
        utm: P.utm,
        anon_id: P.distinctId()
      }))
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.ok) throw new Error(res.body.error || 'request_failed');
        var email = data.email.trim().toLowerCase();
        P.identify(email, { name: data.name.trim(), job_title: data.title, hospital: data.hospital.trim(), bed_band: data.beds });
        P.track('signup_form_submitted', { job_title_bucket: data.title, bed_band: data.beds });
        form.hidden = true;
        var thanks = document.getElementById('thanks');
        thanks.hidden = false;
        thanks.focus();
      })
      .catch(function (error) {
        showError(error.message === 'invalid_input'
          ? 'Something in the form looks off. Please check each field.'
          : 'We couldn\'t save that just now. Please try again in a moment.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join the founding-facility list';
      });
  });

  // Supporting event: optional feedback after signup.
  var fb = document.getElementById('feedback-form');
  fb.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = (document.getElementById('feedback').value || '').trim();
    if (!text) return;
    P.track('feedback_submitted', { feedback: text, feedback_length: text.length, source: 'post_signup' });
    fb.querySelector('textarea').disabled = true;
    fb.querySelector('button').hidden = true;
    document.getElementById('feedback-done').hidden = false;
  });
})();
