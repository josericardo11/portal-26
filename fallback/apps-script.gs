/**
 * Portal signup + email sequence (Google Apps Script; chosen over Apollo).
 * Google Apps Script web app bound to a Google Sheet:
 *   - doPost: stores the signup in the "Signups" sheet and sends the welcome email from your Gmail
 *   - sendFollowUps: run daily by a time trigger; sends follow-up 1 on day 3 and follow-up 2 on day 7
 *
 * Setup: Extensions > Apps Script in the Sheet, paste this file, then in Project Settings > Script
 * properties set SITE_URL (e.g. https://portal-xyz.vercel.app) and SECRET (any random string, also set
 * as APPS_SCRIPT_SECRET in Vercel). Deploy > New deployment > Web app, execute as Me, access Anyone.
 * Put the web app URL in Vercel as APPS_SCRIPT_URL. Run installTrigger() once.
 */
var HEADERS = ['signed_up_at', 'name', 'email', 'title', 'hospital', 'beds', 'pricing_variant',
               'utm_source', 'utm_medium', 'utm_campaign', 'welcome_sent_at', 'followup1_sent_at',
               'followup2_sent_at', 'unsubscribed'];

function props_() { return PropertiesService.getScriptProperties(); }

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Signups') || ss.insertSheet('Signups');
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function links_(email, step) {
  var site = props_().getProperty('SITE_URL');
  var e = encodeURIComponent(email);
  return {
    welcome: site + '/welcome?utm_source=email&utm_medium=email&utm_campaign=welcome_sequence&e=' + e,
    pixel: site + '/api/open?s=' + step + '&e=' + e
  };
}

function send_(lead, step, subject, bodyHtml) {
  var l = links_(lead.email, step);
  var html = bodyHtml.replace('{{welcome_link}}', l.welcome) +
    '<p style="color:#888;font-size:12px">Not interested? Reply "remove me" and we\'ll take you off the list.</p>' +
    '<img src="' + l.pixel + '" width="1" height="1" alt="" style="display:block">';
  GmailApp.sendEmail(lead.email, subject, html.replace(/<[^>]+>/g, ''), { htmlBody: html, name: 'Portal' });
}

function welcome_(lead) {
  var first = String(lead.name).split(' ')[0];
  send_(lead, 'welcome', 'Welcome to the Portal founding-facility list',
    '<p>Hi ' + first + ',</p>' +
    '<p>Thanks for joining the founding-facility list. Portal is in early design with a Florida hospital ' +
    'operations team, and founding facilities shape what gets built first.</p>' +
    '<p><a href="{{welcome_link}}">Here\'s what happens next</a>.</p>' +
    '<p>If you have 20 minutes this month, reply with a couple of times that work.</p><p>Jose</p>');
}

function doPost(e) {
  var lead = JSON.parse(e.postData.contents || '{}');
  if (lead.secret !== props_().getProperty('SECRET')) return json_({ ok: false, error: 'forbidden' });
  var sh = sheet_();
  sh.appendRow(HEADERS.map(function (h) { return lead[h] || ''; }));
  welcome_(lead);
  sh.getRange(sh.getLastRow(), HEADERS.indexOf('welcome_sent_at') + 1).setValue(new Date().toISOString());
  return json_({ ok: true });
}

function sendFollowUps() {
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var col = function (h) { return HEADERS.indexOf(h); };
  var day = 24 * 3600 * 1000;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[col('unsubscribed')] || !r[col('welcome_sent_at')]) continue;
    var lead = { name: r[col('name')], email: r[col('email')] };
    var age = Date.now() - new Date(r[col('signed_up_at')]).getTime();
    var first = String(lead.name).split(' ')[0];
    if (!r[col('followup1_sent_at')] && age > 3 * day) {
      send_(lead, 'followup1', 'Quick question about shift coverage',
        '<p>Hi ' + first + ', what\'s the hardest part of covering open shifts at your facility right now? ' +
        'A one-line reply helps us decide what Portal does first.</p><p>Jose</p>');
      sh.getRange(i + 1, col('followup1_sent_at') + 1).setValue(new Date().toISOString());
    } else if (r[col('followup1_sent_at')] && !r[col('followup2_sent_at')] && age > 7 * day) {
      send_(lead, 'followup2', 'Want an early look at Portal?',
        '<p>Hi ' + first + ', we\'re sharing early design screens with founding facilities. ' +
        'Reply "yes" and I\'ll send a time.</p><p>Jose</p>');
      sh.getRange(i + 1, col('followup2_sent_at') + 1).setValue(new Date().toISOString());
    }
  }
}

function installTrigger() {
  ScriptApp.newTrigger('sendFollowUps').timeBased().everyDays(1).atHour(9).create();
}
