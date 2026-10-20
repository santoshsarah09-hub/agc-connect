/**
 * AGC Connect Hub — backend (Google Apps Script)
 *
 * Runs as YOU, so everything lives in YOUR Google Drive:
 *   My Drive / Executive Assistant Workspace / AGC Connect /
 *       AGC Connect - Hub Data          (Google Sheet: announcements, songs, events, fellowship board, leaders)
 *       Leader Resources /              (put documents here; leaders see them in the app)
 *
 * First-time setup: run setup() once (see SETUP.md).
 * Separate from the Prayer Chain script, so the Prayer Chain keeps working untouched.
 */

var CONFIG = {
  TZ: 'America/Chicago',
  ROOT_FOLDER: 'Executive Assistant Workspace',
  APP_FOLDER: 'AGC Connect',
  RES_FOLDER: 'Leader Resources',
  DATA_NAME: 'AGC Connect - Hub Data',
  TOKEN_SECONDS: 21600,        // a leader stays signed in for 6 hours (the most Google's cache allows)
  MAX_FAILS: 5,                // wrong PINs allowed per leader ...
  LOCK_SECONDS: 900,           // ... before that leader is locked for 15 minutes
  BOARD_PER_HOUR: 5,           // fellowship posts one phone may make per hour
  BOARD_KEEP: 60,              // newest posts shown
  FEED_CACHE_SECONDS: 20
};

var H = {
  leaders: ['id', 'name', 'role', 'salt', 'pinHash', 'active', 'created'],
  ann: ['id', 'scope', 'titleEn', 'titleNe', 'bodyEn', 'bodyNe', 'link', 'pinned', 'created', 'by'],
  songs: ['id', 'titleNe', 'titleEn', 'category', 'link', 'audio', 'songKey', 'created', 'by'],
  events: ['id', 'date', 'time', 'minutes', 'titleEn', 'titleNe', 'place', 'link', 'notes', 'created', 'by'],
  board: ['id', 'name', 'text', 'status', 'created', 'deviceId'],
  lboard: ['id', 'text', 'by', 'created'],
  res: ['id', 'title', 'desc', 'category', 'url', 'created', 'by']
};
var SHEETS = { leaders: 'Leaders', ann: 'Announcements', songs: 'Songs', events: 'Events', board: 'Fellowship', lboard: 'LeaderBoard', res: 'Resources' };

/* ---------------------------------------------------------------- setup */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), CONFIG.ROOT_FOLDER);
  var app = getOrCreateFolder_(root, CONFIG.APP_FOLDER);
  getOrCreateFolder_(app, CONFIG.RES_FOLDER);
  if (!props.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.create(CONFIG.DATA_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(app);
    var first = ss.getSheets()[0];
    first.setName(SHEETS.leaders); prepSheet_(first, H.leaders);
    Object.keys(SHEETS).forEach(function (k) { if (k !== 'leaders') ensureSheet_(ss, SHEETS[k], H[k]); });
    props.setProperty('SHEET_ID', ss.getId());
  } else {
    var ss2 = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    Object.keys(SHEETS).forEach(function (k) { ensureSheet_(ss2, SHEETS[k], H[k]); });
  }
  if (!props.getProperty('ADMIN_PIN')) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    props.setProperty('ADMIN_PIN', pin);
    Logger.log('YOUR ADMIN PIN IS: ' + pin + '  (change it any time in Project Settings > Script properties > ADMIN_PIN)');
  } else {
    Logger.log('Admin PIN already set (see Project Settings > Script properties).');
  }
  if (!props.getProperty('ADMIN_NAME')) props.setProperty('ADMIN_NAME', 'Admin');
  Logger.log('Setup finished. Data sheet: ' + SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl());
}

function prepSheet_(sheet, headers) {
  sheet.getRange(1, 1, sheet.getMaxRows(), Math.max(sheet.getMaxColumns(), headers.length)).setNumberFormat('@');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); prepSheet_(sh, headers); }
  return sh;
}
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function sheets_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() first.');
  var ss = SpreadsheetApp.openById(id), o = {};
  Object.keys(SHEETS).forEach(function (k) { o[k] = ensureSheet_(ss, SHEETS[k], H[k]); });
  return o;
}

/* ------------------------------------------------------------ web entry */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'hub') return json_(getFeed_());
    return json_({ ok: true, app: 'AGC Connect Hub' });
  } catch (err) { return json_({ error: String(err.message || err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    var fn = ACTIONS[body.action];
    if (!fn) throw new Error('Unknown action');
    lock.waitLock(15000);
    var res = fn(body);
    dropFeedCache_();
    return json_(res);
  } catch (err) {
    var msg = String(err.message || err);
    if (/lock/i.test(msg) && !/PIN|locked/i.test(msg)) msg = 'The server is busy right now. Please try again in a moment.';
    return json_({ error: msg });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not held */ }
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------- helpers */

function rows_(sheet) {
  var v = sheet.getDataRange().getValues();
  if (!v.length) return [];
  var head = v[0].map(String), tz = CONFIG.TZ;
  var fmt = head.map(function (h) { return h === 'date' ? 'yyyy-MM-dd' : h === 'time' ? 'HH:mm' : null; });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === '') continue;
    var o = { row: i + 1 };
    head.forEach(function (h, c) {
      var x = v[i][c];
      if (x instanceof Date) x = fmt[c] ? Utilities.formatDate(x, tz, fmt[c]) : x.toISOString();
      o[h] = x === undefined || x === null ? '' : String(x);
    });
    out.push(o);
  }
  return out;
}
function appendObj_(sheet, headers, obj) {
  var r = sheet.getLastRow() + 1, rng = sheet.getRange(r, 1, 1, headers.length);
  rng.setNumberFormat('@');
  rng.setValues([headers.map(function (h) { return String(obj[h] === undefined ? '' : obj[h]); })]);
}
function writeObj_(sheet, headers, row, obj) {
  var rng = sheet.getRange(row, 1, 1, headers.length);
  rng.setNumberFormat('@');
  rng.setValues([headers.map(function (h) { return String(obj[h] === undefined ? '' : obj[h]); })]);
}
function findById_(sheet, id) {
  var all = rows_(sheet);
  for (var i = 0; i < all.length; i++) if (all[i].id === String(id)) return all[i];
  return null;
}
function newId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function nowIso_() { return new Date().toISOString(); }

// Text from outside is never trusted: control characters removed, never starts like a spreadsheet formula.
function txt_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/<[^>]*>/g, ' ').trim();
  s = s.replace(/^[=+\-@]+/, '');
  return Array.from(s).slice(0, max || 500).join('');
}
function firstName_(raw) {
  var s = txt_(raw, 40).replace(/[<>&"'`\\]/g, ' ').trim().split(/\s+/)[0] || '';
  s = Array.from(s).slice(0, 20).join('');
  if (!s) throw new Error('Please enter your first name.');
  return s;
}
function link_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\/[^\s<>"']+$/i.test(s)) throw new Error('A link must start with http:// or https://');
  return s.slice(0, 500);
}
function noLinks_(s) { return String(s).replace(/(https?:\/\/|www\.)\S+/gi, '[link removed]'); }
function dateOk_(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }
function timeOk_(t) { return t === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '')); }

/* ---------------------------------------------------------- PIN + tokens */

function hex_(bytes) {
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
}
function hashPin_(salt, pin) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ':' + String(pin), Utilities.Charset.UTF_8));
}
function newPin_() { return String(Math.floor(100000 + Math.random() * 900000)); }

function failKey_(id) { return 'fail:' + id; }
function login_(b) {
  var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  var id = String(b.leader || ''), pin = String(b.pin || '').trim();
  if (!id || !pin) throw new Error('Choose your name and type your PIN.');
  if (Number(cache.get(failKey_(id))) >= CONFIG.MAX_FAILS) throw new Error('Too many wrong PINs. This sign-in is locked for 15 minutes.');
  var who = null;
  if (id === 'admin') {
    var real = props.getProperty('ADMIN_PIN');
    if (real && pin === real) who = { id: 'admin', name: props.getProperty('ADMIN_NAME') || 'Admin', role: 'Admin', admin: true };
  } else {
    var row = findById_(sheets_().leaders, id);
    if (row && row.active === 'yes' && hashPin_(row.salt, pin) === row.pinHash) who = { id: row.id, name: row.name, role: row.role, admin: false };
  }
  if (!who) {
    cache.put(failKey_(id), String((Number(cache.get(failKey_(id))) || 0) + 1), CONFIG.LOCK_SECONDS);
    throw new Error('That name and PIN do not match.');
  }
  cache.put(failKey_(id), '0', CONFIG.LOCK_SECONDS);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok:' + token, JSON.stringify(who), CONFIG.TOKEN_SECONDS);
  return { ok: true, token: token, name: who.name, role: who.role, admin: who.admin };
}
function who_(b) {
  var raw = CacheService.getScriptCache().get('tok:' + String(b.token || ''));
  if (!raw) throw new Error('Please sign in again.');
  var w = JSON.parse(raw);
  if (w.id !== 'admin') {                       // a removed leader loses access at once
    var row = findById_(sheets_().leaders, w.id);
    if (!row || row.active !== 'yes') throw new Error('Please sign in again.');
  }
  return w;
}
function admin_(b) { var w = who_(b); if (!w.admin) throw new Error('Only the admin can do that.'); return w; }

/* ------------------------------------------------------------ public feed */

function dropFeedCache_() { try { CacheService.getScriptCache().remove('feed'); } catch (e) { /* optimization only */ } }

function getFeed_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('feed');
  if (hit) return JSON.parse(hit);
  var S = sheets_(), today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  var ann = rows_(S.ann).filter(function (r) { return r.scope !== 'leaders'; }).map(annOut_);
  ann.sort(function (a, b) { return (b.pinned - a.pinned) || (a.created < b.created ? 1 : -1); });
  var songs = rows_(S.songs).map(function (r) { return { id: r.id, ne: r.titleNe, en: r.titleEn, cat: r.category, link: r.link, audio: r.audio, key: r.songKey }; });
  var events = rows_(S.events).filter(function (r) { return r.date >= addDays_(today, -1); }).map(function (r) {
    return { id: r.id, date: r.date, time: r.time, minutes: Number(r.minutes) || 60, en: r.titleEn, ne: r.titleNe, place: r.place, link: r.link, notes: r.notes, created: r.created };
  });
  events.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  var board = rows_(S.board).filter(function (r) { return r.status === 'ok'; }).map(function (r) { return { id: r.id, name: r.name, text: r.text, created: r.created }; });
  board.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  var leaders = rows_(S.leaders).filter(function (r) { return r.active === 'yes'; }).map(function (r) { return { id: r.id, name: r.name, role: r.role }; });
  leaders.unshift({ id: 'admin', name: PropertiesService.getScriptProperties().getProperty('ADMIN_NAME') || 'Admin', role: 'Admin' });
  var out = { ok: true, announcements: ann, songs: songs, events: events, board: board.slice(0, CONFIG.BOARD_KEEP), leaders: leaders, now: nowIso_() };
  try { cache.put('feed', JSON.stringify(out), CONFIG.FEED_CACHE_SECONDS); } catch (e) { /* too big to cache */ }
  return out;
}
function annOut_(r) {
  return { id: r.id, scope: r.scope, en: r.titleEn, ne: r.titleNe, bodyEn: r.bodyEn, bodyNe: r.bodyNe, link: r.link, pinned: r.pinned === 'yes' ? 1 : 0, created: r.created, by: r.by };
}
function addDays_(dateStr, n) {
  var p = dateStr.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/* ------------------------------------------------- fellowship (everyone) */

function boardPost_(b) {
  var name = firstName_(b.name), text = noLinks_(txt_(b.text, 280));
  var device = txt_(b.deviceId, 40);
  if (!text) throw new Error('Please type a message.');
  if (!device) throw new Error('Missing device.');
  var cache = CacheService.getScriptCache(), k = 'bp:' + device, n = Number(cache.get(k)) || 0;
  if (n >= CONFIG.BOARD_PER_HOUR) throw new Error('You have posted a lot in the last hour. Please try again later.');
  cache.put(k, String(n + 1), 3600);
  appendObj_(sheets_().board, H.board, { id: newId_(), name: name, text: text, status: 'ok', created: nowIso_(), deviceId: device });
  return { ok: true };
}
function boardReport_(b) {
  var S = sheets_(), r = findById_(S.board, b.id);
  if (r && r.status === 'ok') { r.status = 'reported'; writeObj_(S.board, H.board, r.row, r); }
  return { ok: true };
}

/* ----------------------------------------------------- leaders: content */

function leaderData_(b) {
  var w = who_(b), S = sheets_();
  var ann = rows_(S.ann).map(annOut_); ann.sort(function (a, c) { return a.created < c.created ? 1 : -1; });
  var lb = rows_(S.lboard).map(function (r) { return { id: r.id, text: r.text, by: r.by, created: r.created }; });
  lb.sort(function (a, c) { return a.created < c.created ? 1 : -1; });
  var res = rows_(S.res).map(function (r) { return { id: r.id, title: r.title, desc: r.desc, cat: r.category, url: r.url, by: r.by }; });
  var board = rows_(S.board).filter(function (r) { return r.status !== 'ok'; }).map(function (r) { return { id: r.id, name: r.name, text: r.text, status: r.status, created: r.created }; });
  var team = w.admin ? rows_(S.leaders).map(function (r) { return { id: r.id, name: r.name, role: r.role, active: r.active === 'yes' }; }) : [];
  return { ok: true, me: { name: w.name, role: w.role, admin: w.admin }, announcements: ann.slice(0, 80), lboard: lb.slice(0, 80), resources: res, files: driveFiles_(), flagged: board, team: team };
}

function driveFiles_() {
  try {
    var props = PropertiesService.getScriptProperties(), id = props.getProperty('RES_FOLDER_ID');
    var folder;
    if (id) folder = DriveApp.getFolderById(id);
    else {
      var root = getOrCreateFolder_(DriveApp.getRootFolder(), CONFIG.ROOT_FOLDER);
      folder = getOrCreateFolder_(getOrCreateFolder_(root, CONFIG.APP_FOLDER), CONFIG.RES_FOLDER);
      props.setProperty('RES_FOLDER_ID', folder.getId());
    }
    var out = [];
    collect_(folder, '', out, 0);
    out.sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
    return out.slice(0, 200);
  } catch (e) { Logger.log("driveFiles_ failed: " + e); return []; }
}
function collect_(folder, cat, out, depth) {
  var files = folder.getFiles();
  while (files.hasNext() && out.length < 300) {
    var f = files.next();
    out.push({ name: f.getName(), url: f.getUrl(), type: String(f.getMimeType()).split('/').pop().slice(0, 30), updated: f.getLastUpdated().toISOString(), cat: cat });
  }
  if (depth >= 2) return;
  var subs = folder.getFolders();
  while (subs.hasNext()) { var s = subs.next(); collect_(s, cat ? cat + ' / ' + s.getName() : s.getName(), out, depth + 1); }
}

function annSave_(b) {
  var w = who_(b), S = sheets_();
  var scope = b.scope === 'leaders' ? 'leaders' : b.scope === 'worship' ? 'worship' : 'all';
  var o = { scope: scope, titleEn: txt_(b.titleEn, 120), titleNe: txt_(b.titleNe, 120), bodyEn: txt_(b.bodyEn, 1000), bodyNe: txt_(b.bodyNe, 1000), link: link_(b.link), pinned: b.pinned ? 'yes' : 'no' };
  if (!o.titleEn && !o.titleNe) throw new Error('Please type a title.');
  var ex = b.id ? findById_(S.ann, b.id) : null;
  if (ex) { o.id = ex.id; o.created = ex.created; o.by = ex.by; writeObj_(S.ann, H.ann, ex.row, o); return { ok: true, id: ex.id }; }
  o.id = newId_(); o.created = nowIso_(); o.by = w.name;
  appendObj_(S.ann, H.ann, o);
  return { ok: true, id: o.id };
}
function deleteRow_(key, b) {
  who_(b);
  var S = sheets_(), r = findById_(S[key], b.id);
  if (r) S[key].deleteRow(r.row);
  return { ok: true };
}
function songSave_(b) {
  var w = who_(b), S = sheets_();
  var o = { titleNe: txt_(b.titleNe, 120), titleEn: txt_(b.titleEn, 120), category: txt_(b.category, 40), link: link_(b.link), audio: link_(b.audio), songKey: txt_(b.songKey, 10) };
  if (!o.titleNe && !o.titleEn) throw new Error('Please type the song name.');
  var ex = b.id ? findById_(S.songs, b.id) : null;
  if (ex) { o.id = ex.id; o.created = ex.created; o.by = ex.by; writeObj_(S.songs, H.songs, ex.row, o); return { ok: true, id: ex.id }; }
  o.id = newId_(); o.created = nowIso_(); o.by = w.name;
  appendObj_(S.songs, H.songs, o);
  return { ok: true, id: o.id };
}
function eventSave_(b) {
  var w = who_(b), S = sheets_();
  var o = { date: String(b.date || ''), time: String(b.time || ''), minutes: Math.max(5, Math.min(1440, Number(b.minutes) || 60)), titleEn: txt_(b.titleEn, 120), titleNe: txt_(b.titleNe, 120), place: txt_(b.place, 120), link: link_(b.link), notes: txt_(b.notes, 500) };
  if (!dateOk_(o.date)) throw new Error('Please choose a date.');
  if (!timeOk_(o.time)) throw new Error('Time must look like 18:30.');
  if (!o.titleEn && !o.titleNe) throw new Error('Please type a title.');
  var ex = b.id ? findById_(S.events, b.id) : null;
  if (ex) { o.id = ex.id; o.created = ex.created; o.by = ex.by; writeObj_(S.events, H.events, ex.row, o); return { ok: true, id: ex.id }; }
  o.id = newId_(); o.created = nowIso_(); o.by = w.name;
  appendObj_(S.events, H.events, o);
  return { ok: true, id: o.id };
}
function boardSet_(b) {
  who_(b);
  var S = sheets_(), r = findById_(S.board, b.id);
  if (!r) return { ok: true };
  if (b.status === 'delete') S.board.deleteRow(r.row);
  else { r.status = b.status === 'ok' ? 'ok' : 'hidden'; writeObj_(S.board, H.board, r.row, r); }
  return { ok: true };
}
function lboardPost_(b) {
  var w = who_(b), text = txt_(b.text, 1000);
  if (!text) throw new Error('Please type a message.');
  appendObj_(sheets_().lboard, H.lboard, { id: newId_(), text: text, by: w.name, created: nowIso_() });
  return { ok: true };
}
function lboardDelete_(b) {
  var w = who_(b), S = sheets_(), r = findById_(S.lboard, b.id);
  if (r && (w.admin || r.by === w.name)) S.lboard.deleteRow(r.row);
  return { ok: true };
}
function resSave_(b) {
  var w = who_(b), S = sheets_();
  var o = { title: txt_(b.title, 120), desc: txt_(b.desc, 300), category: txt_(b.category, 40), url: link_(b.url) };
  if (!o.title || !o.url) throw new Error('Please type a title and a link.');
  o.id = newId_(); o.created = nowIso_(); o.by = w.name;
  appendObj_(S.res, H.res, o);
  return { ok: true, id: o.id };
}

/* ------------------------------------------------------- admin: leaders */

function leaderAdd_(b) {
  admin_(b);
  var S = sheets_(), name = firstName_(b.name), role = txt_(b.role, 40) || 'Leader', pin = newPin_(), salt = newId_();
  var id = newId_();
  appendObj_(S.leaders, H.leaders, { id: id, name: name, role: role, salt: salt, pinHash: hashPin_(salt, pin), active: 'yes', created: nowIso_() });
  return { ok: true, id: id, name: name, pin: pin };
}
function leaderReset_(b) {
  admin_(b);
  var S = sheets_(), r = findById_(S.leaders, b.id);
  if (!r) throw new Error('Leader not found.');
  var pin = newPin_(); r.salt = newId_(); r.pinHash = hashPin_(r.salt, pin); r.active = 'yes';
  writeObj_(S.leaders, H.leaders, r.row, r);
  CacheService.getScriptCache().put(failKey_(r.id), '0', CONFIG.LOCK_SECONDS);
  return { ok: true, name: r.name, pin: pin };
}
function leaderRemove_(b) {
  admin_(b);
  var S = sheets_(), r = findById_(S.leaders, b.id);
  if (r) { r.active = 'no'; writeObj_(S.leaders, H.leaders, r.row, r); }
  return { ok: true };
}
function logout_(b) { try { CacheService.getScriptCache().remove('tok:' + String(b.token || '')); } catch (e) { /* gone */ } return { ok: true }; }

var ACTIONS = {
  post: boardPost_, report: boardReport_, login: login_, logout: logout_,
  leaderData: leaderData_, annSave: annSave_, annDelete: function (b) { return deleteRow_('ann', b); },
  songSave: songSave_, songDelete: function (b) { return deleteRow_('songs', b); },
  eventSave: eventSave_, eventDelete: function (b) { return deleteRow_('events', b); },
  boardSet: boardSet_, lboardPost: lboardPost_, lboardDelete: lboardDelete_,
  resSave: resSave_, resDelete: function (b) { return deleteRow_('res', b); },
  leaderAdd: leaderAdd_, leaderReset: leaderReset_, leaderRemove: leaderRemove_
};
