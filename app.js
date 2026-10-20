/* AGC Connect — Prayer Chain, Kids Shine, Youth Shine, Bible.
   Static web app. Pastor-edited content lives in /data/*.json.
   PREVIEW MODE: prayer sign-ups and notes are saved on each person's own device
   until a shared database is connected (see README). */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BOOKS = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];

/* ---------- storage (this device) ---------- */
const KEY = 'agc.connect.v1';
let S = (() => { try { return Object.assign({ slots: {}, notes: [], lang: 'en', ver: {}, cache: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { slots: {}, notes: [], lang: 'en', ver: {}, cache: {} }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- data ---------- */
let CFG = { versions: [], defaultVersion: { en: 'NASB1995', ne: 'NNRV' } }, SHINE = { kids: {}, youth: {} }, PRAYER = { months: [] };
const getJson = u => fetch(u).then(r => r.json()).catch(() => null);

/* ---------- sections ---------- */
const SECTIONS = {
  prayer: { label: 'Prayer Chain', icon: '🙏', tabs: [['signup', 'Sign Up'], ['schedule', 'Schedule'], ['requests', 'Prayer Requests']] },
  kids:   { label: 'Kids Shine',   icon: '🧒', tabs: [['verse', 'Memory Verse'], ['lesson', 'Lesson'], ['games', 'Games'], ['news', 'Announcements']] },
  youth:  { label: 'Youth Shine',  icon: '🔥', tabs: [['verse', 'Memory Verse'], ['lesson', 'Teaching'], ['notes', 'Notes'], ['news', 'Announcements']] },
  bible:  { label: 'Bible',        icon: '📖', tabs: [['read', 'Read'], ['find', 'Find a Verse'], ['notes', 'My Notes']] }
};
let sec = 'prayer';
const tabOf = { prayer: 'signup', kids: 'verse', youth: 'verse', bible: 'read' };

function render() {
  $('#tabs').innerHTML = Object.entries(SECTIONS).map(([k, s]) => `<button data-s="${k}" class="${k === sec ? 'on' : ''}"><span>${s.icon}</span>${s.label}</button>`).join('');
  $('#inner').innerHTML = SECTIONS[sec].tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tabOf[sec] ? 'on' : ''}">${l}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { sec = b.dataset.s; render(); window.scrollTo(0, 0); });
  $('#inner').querySelectorAll('button').forEach(b => b.onclick = () => { tabOf[sec] = b.dataset.t; render(); });
  const v = $('#view'); v.innerHTML = '';
  const fn = VIEWS[sec + '.' + tabOf[sec]];
  fn ? fn(v) : (v.innerHTML = '<div class="card">Coming soon.</div>');
}

/* ---------- Bible versions + passages ---------- */
function lang() { return S.lang || 'en'; }
function curVersion() {
  const l = lang(), id = (S.ver && S.ver[l]) || CFG.defaultVersion[l];
  return CFG.versions.find(v => v.id === id) || CFG.versions.find(v => v.lang === l) || CFG.versions[0];
}
function versionPicker(el, onChange) {
  const l = lang(), cur = curVersion();
  el.innerHTML = `<div class="seg"><button class="btn small ${l === 'en' ? '' : 'ghost'}" data-l="en">English</button><button class="btn small ${l === 'ne' ? '' : 'ghost'}" data-l="ne">नेपाली</button></div>
    <label for="vsel">Bible version</label><select id="vsel">${CFG.versions.filter(v => v.lang === l).map(v => `<option value="${esc(v.id)}" ${v.id === cur.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>`;
  el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { S.lang = b.dataset.l; save(); onChange(); });
  $('#vsel', el).onchange = e => { S.ver[lang()] = e.target.value; save(); onChange(); };
}
async function webText(ref) {
  if (S.cache[ref]) return S.cache[ref];
  const r = await fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=web');
  if (!r.ok) throw new Error('lookup');
  const j = await r.json(), t = (j.text || '').replace(/\s+/g, ' ').trim();
  if (t) { S.cache[ref] = t; save(); }
  return t;
}
async function showPassage(el, ref) {
  const v = curVersion();
  if (v.type === 'none') { el.innerHTML = `<p class="bad">${esc(v.note || 'This version is not connected yet.')}</p>`; return; }
  if (v.type === 'link') {
    const enc = s => encodeURIComponent(s).replace(/%3A/gi, ':');
    const url = v.url.replace('{refNoSpace}', enc(ref.replace(/\s+/g, ''))).replace('{ref}', enc(ref));
    el.innerHTML = `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">📖 Read ${esc(ref)} in ${esc(v.name)}</a><p class="muted">${esc(v.note || '')}</p>`; return;
  }
  el.textContent = 'Loading…';
  try {
    const r = await fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=' + (v.api || 'web'));
    if (!r.ok) throw 0;
    const j = await r.json();
    el.innerHTML = `<div class="ref">${esc(j.reference)}</div>` + (j.verses || []).map(x => `<p><b>${x.verse}</b> ${esc(String(x.text).trim())}</p>`).join('') + `<p class="muted">${esc(v.name)}</p>`;
  } catch (e) { el.innerHTML = '<p class="bad">Could not load that passage. Check the reference and your connection.</p>'; }
}

/* ---------- notes (generic, per scope) ---------- */
const noteEdit = {};
function notesView(v, scope, title) {
  const mine = S.notes.filter(n => n.scope === scope).sort((a, b) => b.date.localeCompare(a.date));
  const e = noteEdit[scope];
  if (e) {
    const n = S.notes.find(x => x.id === e) || { title: '', body: '' };
    v.innerHTML = `<div class="card"><h2>${e === 'new' ? 'New note' : 'Edit note'}</h2>
      <label for="nt">Title</label><input id="nt" value="${esc(n.title)}"><label for="nb">Note</label><textarea id="nb">${esc(n.body)}</textarea>
      <button class="btn" id="ns">Save</button><button class="btn ghost" id="nc">Cancel</button>${e !== 'new' ? '<button class="btn ghost small" id="nd">Delete</button>' : ''}</div>`;
    $('#nc').onclick = () => { noteEdit[scope] = null; render(); };
    $('#ns').onclick = () => {
      const t = $('#nt').value.trim() || 'Untitled', b = $('#nb').value;
      if (e === 'new') S.notes.push({ id: uid(), scope, title: t, body: b, date: new Date().toISOString() }); else Object.assign(S.notes.find(x => x.id === e), { title: t, body: b });
      save(); noteEdit[scope] = null; render();
    };
    const d = $('#nd'); if (d) d.onclick = () => { if (confirm('Delete this note?')) { S.notes = S.notes.filter(x => x.id !== e); save(); noteEdit[scope] = null; render(); } };
    return;
  }
  v.innerHTML = `<div class="preview">Notes are saved on this phone only.</div><button class="btn" id="nn">+ New note</button>
    <div class="card">${mine.length ? mine.map(n => `<div class="note-item" data-n="${n.id}"><b>${esc(n.title)}</b><div class="muted">${new Date(n.date).toLocaleDateString()}</div><div>${esc(n.body.slice(0, 90))}${n.body.length > 90 ? '…' : ''}</div></div>`).join('') : '<span class="muted">No notes yet.</span>'}</div>`;
  $('#nn').onclick = () => { noteEdit[scope] = 'new'; render(); };
  v.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { noteEdit[scope] = x.dataset.n; render(); });
}

/* ---------- Prayer Chain ---------- */
function chainDate() {
  const now = new Date();
  const first = (y, m) => { const d = new Date(y, m, 1, 12); d.setDate(1 + ((6 - d.getDay() + 7) % 7)); return d; };
  let d = first(now.getFullYear(), now.getMonth());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (d < today) d = first(now.getFullYear(), now.getMonth() + 1);
  return d;
}
const dateKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hourLabel = h => { const f = x => { const n = x % 24, s = n >= 12 ? 'PM' : 'AM', t = n % 12 || 12; return t + ':00 ' + s; }; return f(h) + ' – ' + f(h + 1); };
const chainTitle = d => 'Saturday, ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const slotKey = (d, h) => dateKey(d) + '-' + String(h).padStart(2, '0');

function previewNote() { return '<div class="preview">Preview: sign-ups are saved on this phone only until the shared sign-up sheet is connected.</div>'; }

function prayerSignup(v) {
  const d = chainDate();
  v.innerHTML = `${previewNote()}<div class="card gold"><div class="muted">Next prayer chain</div><h2>${esc(chainTitle(d))}</h2>
    <p class="muted">24 hours, 12 AM to 12 AM Central Time. Pick an open 1-hour slot.</p>
    <label for="who">Your first name</label><input id="who" maxlength="20" autocomplete="given-name"><div id="smsg"></div></div>
    <div class="card" id="open"></div>`;
  const draw = () => {
    const open = [...Array(24).keys()].filter(h => !S.slots[slotKey(d, h)]);
    $('#open').innerHTML = open.length ? '<h2>Open slots</h2>' + open.map(h => `<div class="slot"><div class="t">${hourLabel(h)}</div><button class="btn small" data-h="${h}">Take it</button></div>`).join('') : '<b>All 24 hours are taken. Thank you!</b>';
    v.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
      const name = $('#who').value.trim().split(/\s+/)[0];
      if (!name) { $('#smsg').innerHTML = '<span class="bad">Please type your first name first.</span>'; $('#who').focus(); return; }
      S.slots[slotKey(d, +b.dataset.h)] = name; save();
      $('#smsg').innerHTML = `<span class="good">Thank you, ${esc(name)}! You have ${hourLabel(+b.dataset.h)}.</span>`; draw();
    });
  };
  draw();
}
function prayerSchedule(v) {
  const d = chainDate();
  v.innerHTML = `${previewNote()}<div class="card gold"><h2>${esc(chainTitle(d))}</h2><p class="muted">12 AM to 12 AM Central Time</p></div>
    <div class="card">${[...Array(24).keys()].map(h => { const n = S.slots[slotKey(d, h)]; return `<div class="slot"><div class="t">${hourLabel(h)}</div>${n ? `<b>${esc(n)}</b> <button class="btn ghost small" data-r="${h}" aria-label="Release slot">✕</button>` : '<span class="open">Open</span>'}</div>`; }).join('')}</div>`;
  v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { if (confirm('Release this slot?')) { delete S.slots[slotKey(d, +b.dataset.r)]; save(); render(); } });
}
function prayerRequests(v) {
  const ms = (PRAYER.months || []).slice();
  const m = ms.length ? ms[ms.length - 1] : null;
  if (!m || !(m.items || []).length) { v.innerHTML = '<div class="card red"><h2>Prayer requests</h2><p>This month\'s prayer requests will be posted here before the chain.</p></div>'; return; }
  v.innerHTML = `<div class="card red"><h2>${esc(m.month || 'This month')}</h2><div class="cols"><b>English</b><b>नेपाली</b></div></div>` +
    m.items.map(i => `<div class="card"><div class="cols"><div>${esc(i.en)}</div><div>${esc(i.ne)}</div></div></div>`).join('');
}

/* ---------- Shine ---------- */
const DEFAULT_LESSON = { kids: "This Sunday's lesson will be posted here.", youth: "This week's teaching will be posted here." };
function shineVerse(v, key) {
  const ref = (SHINE[key] || {}).verse;
  v.innerHTML = `<div class="card gold"><div class="muted">This week's memory verse</div><div class="ref" style="font-size:22px">${esc(ref || '—')}</div></div>
    <div class="card"><div id="vp"></div></div><div class="card" id="pass"></div>`;
  if (!ref) { $('#pass').textContent = 'No verse set yet.'; return; }
  versionPicker($('#vp'), () => shineVerse(v, key));
  showPassage($('#pass'), ref);
}
const shineText = (key, field, dflt) => v => { const t = (SHINE[key] || {})[field]; v.innerHTML = `<div class="card ${field === 'news' ? 'red' : ''}"><p style="margin:0">${esc(t || dflt)}</p></div>`; };

let gMode = null, gs = null;
function kidsGames(v) {
  if (!gMode) {
    v.innerHTML = `<div class="card gold"><h2>Word Order</h2><p>Tap the words in the right order to build the verse.</p><button class="btn" data-g="order">Play</button></div>
      <div class="card gold"><h2>Which verse is it?</h2><p>Read the words, pick the right reference.</p><button class="btn" data-g="match">Play</button></div>
      <p class="muted">Games use the public-domain World English Bible.</p>`;
    v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { gMode = b.dataset.g; gs = null; render(); });
    return;
  }
  const list = (SHINE.kids || {}).gameVerses || [];
  v.innerHTML = '<div class="card">Loading…</div>';
  (gMode === 'order' ? gameOrder : gameMatch)(v, list).catch(() => { v.innerHTML = '<div class="card">Could not load verses. Check your connection.</div>'; });
}
const back = '<button class="btn ghost small" id="gb">← Games</button>';
async function gameOrder(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) { const ref = list[Math.floor(Math.random() * list.length)]; const words = (await webText(ref)).split(' '); gs = { ref, words, bank: shuffle(words.map((w, i) => ({ w, i }))), picked: [] }; }
  const left = gs.bank.filter(b => !gs.picked.includes(b)), done = gs.picked.length === gs.words.length;
  v.innerHTML = `${back}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse" style="min-height:60px">${gs.picked.map(p => esc(p.w)).join(' ') || '<span class="muted">Tap the first word…</span>'}</div></div>
    <div class="card">${left.map(b => `<span class="chip" data-w="${b.i}">${esc(b.w)}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">You did it! ⭐</span>' : ''}</div>
    ${done ? '<button class="btn small" id="again">Next verse</button>' : '<button class="btn ghost small" id="undo">Undo</button>'}</div>`;
  $('#gb').onclick = () => { gMode = null; gs = null; render(); };
  v.querySelectorAll('[data-w]').forEach(c => c.onclick = () => {
    const b = gs.bank.find(x => x.i === +c.dataset.w);
    if (b.w === gs.words[gs.picked.length]) { gs.picked.push(b); gameOrder(v, list); } else $('#msg').innerHTML = '<span class="bad">Try a different word.</span>';
  });
  const u = $('#undo'); if (u) u.onclick = () => { gs.picked.pop(); gameOrder(v, list); };
  const a = $('#again'); if (a) a.onclick = () => { gs = null; render(); };
}
async function gameMatch(v, list) {
  if (list.length < 3) { v.innerHTML = '<div class="card">Add at least 3 game verses in data/shine.json.</div>'; return; }
  if (!gs) { const ref = list[Math.floor(Math.random() * list.length)]; gs = { ref, text: await webText(ref), opts: shuffle([ref, ...shuffle(list.filter(r => r !== ref)).slice(0, 2)]), ok: false }; }
  v.innerHTML = `${back}<div class="card gold"><div class="verse">${esc(gs.text)}</div></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = () => { gMode = null; gs = null; render(); };
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.ref) { gs.ok = true; $('#msg').innerHTML = '<span class="good">Correct! ⭐</span>'; const a = $('#again'); a.style.display = 'inline-block'; a.onclick = () => { gs = null; render(); }; }
    else $('#msg').innerHTML = '<span class="bad">Not quite — try again.</span>';
  });
}

/* ---------- Bible ---------- */
let bib = { book: 'John', chap: 1 };
function bibleRead(v) {
  v.innerHTML = `<div class="card"><div id="vp"></div><div class="row"><div class="grow" style="flex:2"><label for="bb">Book</label><select id="bb">${BOOKS.map(b => `<option ${b === bib.book ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    <div class="grow"><label for="bc">Chapter</label><input id="bc" type="number" min="1" max="150" value="${bib.chap}" inputmode="numeric"></div></div><button class="btn" id="go">Read</button></div><div class="card" id="pass"><span class="muted">Pick a book and chapter.</span></div>`;
  versionPicker($('#vp'), () => bibleRead(v));
  $('#go').onclick = () => { bib.book = $('#bb').value; bib.chap = Math.max(1, parseInt($('#bc').value, 10) || 1); showPassage($('#pass'), bib.book + ' ' + bib.chap); };
}
function bibleFind(v) {
  v.innerHTML = `<div class="card"><div id="vp"></div><label for="fr">Verse (for example John 3:16)</label><input id="fr" autocomplete="off"><button class="btn" id="go">Find</button></div><div class="card" id="pass"><span class="muted">Type a reference.</span></div>`;
  versionPicker($('#vp'), () => bibleFind(v));
  $('#go').onclick = () => { const r = $('#fr').value.trim(); if (r) showPassage($('#pass'), r); };
}

const VIEWS = {
  'prayer.signup': prayerSignup, 'prayer.schedule': prayerSchedule, 'prayer.requests': prayerRequests,
  'kids.verse': v => shineVerse(v, 'kids'), 'kids.lesson': shineText('kids', 'lesson', DEFAULT_LESSON.kids), 'kids.games': kidsGames, 'kids.news': shineText('kids', 'news', 'No announcements right now. Check back soon!'),
  'youth.verse': v => shineVerse(v, 'youth'), 'youth.lesson': shineText('youth', 'lesson', DEFAULT_LESSON.youth), 'youth.notes': v => notesView(v, 'youth', 'Notes'), 'youth.news': shineText('youth', 'news', 'No announcements right now. Check back soon!'),
  'bible.read': bibleRead, 'bible.find': bibleFind, 'bible.notes': v => notesView(v, 'bible', 'My Notes')
};

/* ---------- start + member password ---------- */
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function startApp() { $('#gate').hidden = true; $('#app').hidden = false; render(); }
(async function init() {
  CFG = (await getJson('data/config.json')) || CFG;
  SHINE = (await getJson('data/shine.json')) || SHINE;
  PRAYER = (await getJson('data/prayer.json')) || PRAYER;
  const hash = (CFG.passwordSha256 || '').toLowerCase();
  let ok = !hash;
  try { ok = ok || sessionStorage.getItem('agc.ok') === hash; } catch (e) {}
  if (ok) return startApp();
  $('#gate').hidden = false;
  const tryPw = async () => {
    if ((await sha256($('#pw').value)) === hash) { try { sessionStorage.setItem('agc.ok', hash); } catch (e) {} startApp(); }
    else $('#pwmsg').textContent = 'That password is not right.';
  };
  $('#pwgo').onclick = tryPw; $('#pw').onkeydown = e => { if (e.key === 'Enter') tryPw(); };
})();
