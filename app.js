/* AGC Connect — Home, Prayer Chain, Kids Shine, Youth Shine, Bible.
   Static web app. Pastor-edited content lives in /data/*.json.
   PREVIEW MODE: prayer sign-ups, profiles, notes and chat are saved on each person's own
   device until a shared database is connected (see README). */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const BOOKS = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
const USFM = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');

/* ---------- storage (this device) ---------- */
const KEY = 'agc.connect.v2';
const blank = () => ({ slots: {}, notes: [], lang: 'en', ver: {}, cache: {}, profiles: [], cur: {}, chat: { kids: [], youth: [] }, leader: false });
let S = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- data ---------- */
let CFG = { versions: [], defaultVersion: { en: 'NASB1995', ne: 'NNRV' }, youversion: {}, chat: { kids: 'leaders-only', youth: 'open', maxLength: 280 } };
let SHINE = { kids: {}, youth: {} }, PRAYER = { months: [] }, HOME = {}, VOTD = { refs: [] }, GAMES = { whoAmI: [] };
const getJson = u => fetch(u).then(r => r.json()).catch(() => null);

/* ---------- sections ---------- */
const SECTIONS = {
  home:   { label: 'Home',        icon: '🏠', tabs: [['today', 'Today'], ['mv', 'Mission & Vision'], ['e4', '4E']] },
  prayer: { label: 'Prayer',      icon: '🙏', tabs: [['signup', 'Sign Up'], ['schedule', 'Schedule'], ['requests', 'Prayer Requests']] },
  kids:   { label: 'Kids Shine',  icon: '🧒', tabs: [['verse', 'Memory Verse'], ['games', 'Games'], ['lesson', 'Lesson'], ['chat', 'Chat'], ['news', 'Announcements'], ['me', 'My Kids']] },
  youth:  { label: 'Youth Shine', icon: '🔥', tabs: [['verse', 'Memory Verse'], ['lesson', 'Teaching'], ['notes', 'Notes'], ['chat', 'Chat'], ['news', 'Announcements'], ['me', 'My Profile']] },
  bible:  { label: 'Bible',       icon: '📖', tabs: [['read', 'Read'], ['find', 'Find a Verse'], ['notes', 'My Notes']] }
};
let sec = 'home';
const tabOf = { home: 'today', prayer: 'signup', kids: 'verse', youth: 'verse', bible: 'read' };

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
const lang = () => S.lang || 'en';
function verOf(l) {
  const id = (S.ver && S.ver[l]) || CFG.defaultVersion[l];
  return CFG.versions.find(v => v.id === id) || CFG.versions.find(v => v.lang === l) || CFG.versions[0];
}
const curVersion = () => verOf(lang());
function usableVer(l) { // if the chosen version is not connected, use a working one in the same language
  const v = verOf(l);
  if (v.type !== 'none') return { v, note: '' };
  const alt = CFG.versions.find(x => x.lang === l && x.type !== 'none');
  return { v: alt || v, note: v.note || '' };
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
const encRef = s => encodeURIComponent(s).replace(/%3A/gi, ':');
async function showPassage(el, ref, ver) {
  const v = ver || curVersion();
  if (v.type === 'none') { el.innerHTML = `<p class="bad">${esc(v.note || 'This version is not connected yet.')}</p>`; return; }
  if (v.type === 'link') {
    const url = v.url.replace('{refNoSpace}', encRef(ref.replace(/\s+/g, ''))).replace('{ref}', encRef(ref));
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
function speak(text, l) {
  if (!('speechSynthesis' in window)) { alert('Read-aloud is not available on this device.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = l === 'ne' ? 'ne-NP' : 'en-US'; u.rate = 0.9;
  if (l === 'ne' && !(speechSynthesis.getVoices() || []).some(x => /^ne/i.test(x.lang))) { alert('This phone has no Nepali voice for read-aloud.'); return; }
  speechSynthesis.speak(u);
}

/* ---------- Home ---------- */
const dayOfYear = d => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
function usfmToRef(pid) {
  const parts = String(pid || '').split('-'), a = parts[0].split('.');
  const i = USFM.indexOf(a[0]); if (i < 0 || a.length < 2) return null;
  const name = BOOKS[i] === 'Psalms' ? 'Psalm' : BOOKS[i];
  let r = name + ' ' + a[1] + (a[2] ? ':' + a[2] : '');
  if (parts[1]) { const end = parts[1].split('.').pop(); if (/^\d+$/.test(end)) r += '-' + end; }
  return r;
}
async function votdRef() {
  const now = new Date(), n = dayOfYear(now), key = 'votd-' + now.getFullYear() + '-' + n;
  if (S.cache[key]) return S.cache[key];
  const yv = CFG.youversion || {};
  if (yv.appKey) {
    try {
      const r = await fetch((yv.baseUrl || 'https://api.youversion.com') + '/v1/verse-of-the-days/' + n, { headers: { 'X-YVP-App-Key': yv.appKey } });
      if (r.ok) { const ref = usfmToRef((await r.json()).passage_id); if (ref) { S.cache[key] = ref; save(); return ref; } }
    } catch (e) {}
  }
  const list = VOTD.refs || [];
  return list.length ? list[n % list.length] : null;
}
async function homeToday(v) {
  v.innerHTML = `<div class="hero"><img src="assets/logo-full.png" alt="Awakening Generations Church. ${esc(HOME.tagline || '')}"></div>
    <div class="card votd"><div class="muted">Verse of the Day</div><div class="ref" id="vref" style="font-size:22px">Loading…</div>
      <div class="votd-lang">English</div><div id="ven"></div>
      <div class="votd-lang">नेपाली</div><div id="vne"></div>
      <p class="muted" id="vsrc"></p></div>`;
  const ref = await votdRef();
  if (!ref) { $('#vref').textContent = '—'; return; }
  $('#vref').textContent = ref;
  const en = usableVer('en'), ne = usableVer('ne');
  showPassage($('#ven'), ref, en.v);
  showPassage($('#vne'), ref, ne.v).then(() => { if (ne.note) $('#vne').insertAdjacentHTML('afterbegin', `<p class="muted">${esc(ne.note)}</p>`); });
  $('#vsrc').textContent = (CFG.youversion || {}).appKey ? 'Passage chosen by YouVersion.' : 'Today\'s passage is picked from the church list.';
}
function ref2chips(refs) { return refs.map(r => `<span class="refchip" data-r="${esc(r)}">${esc(r)}</span>`).join(''); }
function wireChips(el, out) {
  el.querySelectorAll('[data-r]').forEach(c => c.onclick = () => { out.hidden = false; showPassage(out, c.dataset.r, usableVer('en').v); });
}
function homeMV(v) {
  const box = (title, o, cls) => `<div class="card ${cls}"><h2>${title}</h2><p>${esc((o || {}).en)}</p>${(o || {}).ne ? `<p lang="ne">${esc(o.ne)}</p>` : ''}</div>`;
  v.innerHTML = box('Our Mission', HOME.mission, 'gold') + box('Our Vision', HOME.vision, 'red') +
    `<div class="card"><h2>${esc(HOME.tagline || '')}</h2><p class="muted">Equip • Evangelize • Exalt • Edify</p></div>`;
}
function homeE4(v) {
  const list = HOME.fourE || [];
  v.innerHTML = list.map((e, i) => `<div class="card e4" style="border-top-color:${esc(e.color)}"><h2>${esc(e.icon)} ${esc(e.name)}</h2><p>${esc(e.en)}</p>${e.ne ? `<p lang="ne">${esc(e.ne)}</p>` : ''}<div>${ref2chips(e.refs || [])}</div><div class="out" hidden></div></div>`).join('');
  v.querySelectorAll('.card').forEach(c => wireChips(c, $('.out', c)));
}

/* ---------- notes (generic, per scope) ---------- */
const noteEdit = {};
function notesView(v, scope) {
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

/* ---------- Prayer Chain (unchanged behavior) ---------- */
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
const previewNote = () => '<div class="preview">Preview: sign-ups are saved on this phone only until the shared sign-up sheet is connected.</div>';

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
  const ms = (PRAYER.months || []).slice(), m = ms.length ? ms[ms.length - 1] : null;
  if (!m || !(m.items || []).length) { v.innerHTML = '<div class="card red"><h2>Prayer requests</h2><p>This month\'s prayer requests will be posted here before the chain.</p></div>'; return; }
  v.innerHTML = `<div class="card red"><h2>${esc(m.month || 'This month')}</h2><div class="cols"><b>English</b><b>नेपाली</b></div></div>` +
    m.items.map(i => `<div class="card"><div class="cols"><div>${esc(i.en)}</div><div>${esc(i.ne)}</div></div></div>`).join('');
}

/* ---------- profiles (add a child / youth profile) ---------- */
const profilesOf = g => S.profiles.filter(p => p.group === g);
function curProfile(g) { return S.profiles.find(p => p.id === S.cur[g] && p.group === g) || profilesOf(g)[0] || null; }
function awardStars(g, n) { const p = curProfile(g); if (p) { p.stars += n; save(); } }
function addForm(g) {
  const kidsG = g === 'kids';
  return `<div class="card gold"><h2>${kidsG ? 'Add a child' : 'Add your profile'}</h2>
    <p class="muted">${kidsG ? 'A parent adds each child.' : ''} First name only. Saved on this phone.</p>
    <label for="pn">First name</label><input id="pn" maxlength="20" autocomplete="off">
    ${kidsG ? '<label for="pa">Age group</label><select id="pa"><option value="younger">Younger kids</option><option value="older">Older kids</option></select>' : ''}
    <button class="btn" id="padd">${kidsG ? 'Add child' : 'Save profile'}</button><div id="pmsg"></div></div>`;
}
function wireAdd(g) {
  const b = $('#padd'); if (!b) return;
  b.onclick = () => {
    const name = $('#pn').value.trim().split(/\s+/)[0];
    if (!name) { $('#pmsg').innerHTML = '<span class="bad">Please type a first name.</span>'; return; }
    const p = { id: uid(), name: name.slice(0, 20), group: g, age: g === 'kids' ? $('#pa').value : 'older', stars: 0, learned: [], steps: {} };
    S.profiles.push(p); S.cur[g] = p.id; save(); render();
  };
}
function profileBar(g) {
  const list = profilesOf(g), p = curProfile(g);
  return `<div class="pbar"><b>${esc(p.name)}</b><span>⭐ ${p.stars}</span><span class="muted">${p.learned.length} verse${p.learned.length === 1 ? '' : 's'} learned</span>
    ${list.length > 1 ? `<select id="pswitch" aria-label="Switch ${g === 'kids' ? 'child' : 'profile'}">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div>`;
}
function wireBar(g) { const s = $('#pswitch'); if (s) s.onchange = e => { S.cur[g] = e.target.value; save(); render(); }; }
function needProfile(v, g) {
  if (curProfile(g)) return curProfile(g);
  v.innerHTML = addForm(g); wireAdd(g); return null;
}
function profilesTab(v, g) {
  const list = profilesOf(g);
  v.innerHTML = `<div class="preview">Profiles and progress are saved on this phone only.</div>
    ${list.length ? `<div class="card"><h2>${g === 'kids' ? 'Your children' : 'Profiles'}</h2>${list.map(p => `<div class="slot"><div class="t">${esc(p.name)} <span class="muted">${g === 'kids' ? (p.age === 'younger' ? 'Younger' : 'Older') + ' · ' : ''}⭐ ${p.stars} · ${p.learned.length} learned</span></div>
      <button class="btn small ${p.id === (curProfile(g) || {}).id ? '' : 'ghost'}" data-s="${p.id}">${p.id === (curProfile(g) || {}).id ? 'Active' : 'Switch'}</button>
      <button class="btn small ghost" data-x="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button></div>`).join('')}</div>` : ''}
    ${addForm(g)}`;
  wireAdd(g);
  v.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.cur[g] = b.dataset.s; save(); render(); });
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    if (!confirm('Remove this profile and its progress from this phone?')) return;
    S.profiles = S.profiles.filter(p => p.id !== b.dataset.x); if (S.cur[g] === b.dataset.x) delete S.cur[g]; save(); render();
  });
}

/* ---------- Memory verse: 6 steps (Kids and Youth) ---------- */
const STEPS = [[1, 'Read'], [2, 'Listen'], [3, 'Pieces'], [4, 'Blanks'], [5, 'Letters'], [6, 'Recite']];
let MS = null;
async function practiceText(g, ref) {
  const l = lang(), ver = verOf(l), custom = ((SHINE[g] || {}).verseText || {})[ver.id];
  if (custom && custom.trim()) return { text: custom.trim().replace(/\s+/g, ' '), label: ver.name, l, fallback: false };
  return { text: await webText(ref), label: 'World English Bible', l: 'en', fallback: true, want: ver.name };
}
function chunksOf(text) {
  const out = [];
  text.split(/(?<=[,;:.!?])\s+/).forEach(seg => { const w = seg.split(' '); if (w.length <= 7) out.push(seg); else for (let i = 0; i < w.length; i += 5) out.push(w.slice(i, i + 5).join(' ')); });
  return out.filter(Boolean);
}
function stepDone(p, ref, id) { return ((p.steps || {})[ref] || []).includes(id); }
function finishStep(g, ref, id) {
  const p = curProfile(g); p.steps = p.steps || {};
  const a = p.steps[ref] = p.steps[ref] || [];
  if (!a.includes(id)) a.push(id);
  let all = false;
  if (STEPS.every(s => a.includes(s[0])) && !p.learned.includes(ref)) { p.learned.push(ref); p.stars += 5; all = true; }
  save(); return all;
}
async function memorize(v, g) {
  const p = needProfile(v, g); if (!p) return;
  const ref = (SHINE[g] || {}).verse;
  if (!ref) { v.innerHTML = '<div class="card">No verse is set for this week yet.</div>'; return; }
  v.innerHTML = `${profileBar(g)}<div class="card gold"><div class="muted">This week's memory verse</div><div class="ref" style="font-size:22px">${esc(ref)}</div><div id="vp"></div></div>
    <div class="card"><div class="stepper" id="stepper"></div><div id="stepbody">Loading…</div></div>`;
  wireBar(g);
  versionPicker($('#vp'), () => { MS = null; render(); });
  let t;
  try { t = await practiceText(g, ref); } catch (e) { $('#stepbody').innerHTML = '<p class="bad">Could not load the verse. Check your connection.</p>'; return; }
  const key = [g, ref, p.id, lang(), verOf(lang()).id].join('|');
  if (!MS || MS.key !== key) MS = { key, g, ref, step: 1, t, words: t.text.split(' '), reads: 0, ci: 0, hid: false, lvl: 0 };
  drawSteps(v);
}
function drawSteps(v) {
  const m = MS, p = curProfile(m.g);
  $('#stepper').innerHTML = STEPS.map(([id, label]) => `<button data-st="${id}" class="${m.step === id ? 'on' : ''} ${stepDone(p, m.ref, id) ? 'done' : ''}">${stepDone(p, m.ref, id) ? '✓ ' : id + '. '}${label}</button>`).join('');
  $('#stepper').querySelectorAll('button').forEach(b => b.onclick = () => { m.celebrate = false; m.step = +b.dataset.st; m.reads = 0; m.ci = 0; m.hid = false; m.lvl = 0; m.solve = null; drawSteps(v); });
  const body = $('#stepbody');
  const note = m.t.fallback ? `<p class="muted">Practicing with the ${esc(m.t.label)}. To practice in ${esc(m.t.want)}, a leader can paste its verse text into data/shine.json.</p>` : `<p class="muted">${esc(m.t.label)}</p>`;
  const done = id => { const all = finishStep(m.g, m.ref, id); const nxt = STEPS.find(s => !stepDone(curProfile(m.g), m.ref, s[0])); if (all) { m.celebrate = true; } else if (nxt) m.step = nxt[0]; m.reads = 0; m.ci = 0; m.hid = false; m.lvl = 0; m.solve = null; drawSteps(v); };
  if (m.celebrate) { body.innerHTML = `<div class="bigword">🎉 You learned ${esc(m.ref)}!</div><p style="text-align:center"><span class="good">+5 ⭐ Now say it to a parent or leader.</span></p>`; return; }
  const verse = `<div class="verse">${esc(m.t.text)}</div>`;
  if (m.step === 1) {
    body.innerHTML = `<h2>Step 1: Read it</h2>${verse}${note}<p>Read it out loud 3 times. Tap after each time.</p><button class="btn" id="rd">I read it (${m.reads}/3)</button>`;
    $('#rd').onclick = () => { m.reads++; if (m.reads >= 3) done(1); else drawSteps(v); };
  } else if (m.step === 2) {
    body.innerHTML = `<h2>Step 2: Listen</h2>${verse}${note}<button class="btn alt" id="sp">🔊 Read to me</button><button class="btn" id="dn">I listened ✓</button>`;
    $('#sp').onclick = () => speak(m.t.text, m.t.l); $('#dn').onclick = () => done(2);
  } else if (m.step === 3) {
    const ch = chunksOf(m.t.text);
    body.innerHTML = `<h2>Step 3: Pieces</h2>${note}<p class="muted">Piece ${m.ci + 1} of ${ch.length}. Read it, hide it, say it.</p><div class="bigword" id="pc">${m.hid ? '❓ Say it!' : esc(ch[m.ci])}</div>
      <button class="btn ghost" id="hd">${m.hid ? 'Show me' : 'Hide it'}</button><button class="btn" id="ok">I said it ✓</button>`;
    $('#hd').onclick = () => { m.hid = !m.hid; drawSteps(v); };
    $('#ok').onclick = () => { if (m.ci + 1 >= ch.length) done(3); else { m.ci++; m.hid = false; drawSteps(v); } };
  } else if (m.step === 4) {
    blanksStep(v, body, note, done);
  } else if (m.step === 5) {
    const cues = m.words.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || w.charAt(0)).join(' ');
    body.innerHTML = `<h2>Step 5: First letters</h2>${note}<div class="letters">${esc(cues)}</div>
      <p>Say the whole verse using only the letters to help you.</p><div id="rv">${m.hid ? verse : ''}</div>
      <button class="btn ghost" id="ck">${m.hid ? 'Hide again' : 'Check myself'}</button><button class="btn" id="ok">I got it ✓</button>`;
    $('#ck').onclick = () => { m.hid = !m.hid; drawSteps(v); }; $('#ok').onclick = () => done(5);
  } else {
    body.innerHTML = `<h2>Step 6: Recite</h2>${note}<div class="bigword">${m.hid ? '' : '🙈'}</div><div id="rv">${m.hid ? verse : ''}</div>
      <p>Say the whole verse from memory. Then check.</p><button class="btn ghost" id="ck">${m.hid ? 'Hide' : 'Check'}</button><button class="btn alt" id="ok">I said it perfectly ⭐</button>`;
    $('#ck').onclick = () => { m.hid = !m.hid; drawSteps(v); }; $('#ok').onclick = () => done(6);
  }
}
function blanksStep(v, body, note, done) {
  const m = MS, words = m.words;
  if (!m.solve) {
    const lvl = m.lvl || 1, n = Math.max(1, Math.round(words.length * [0, 0.2, 0.4, 0.7][lvl]));
    const cand = words.map((w, i) => [w, i]).filter(([w]) => w.replace(/[^\p{L}\p{N}]/gu, '').length > 2).map(([, i]) => i);
    const idx = shuffle(cand).slice(0, n).sort((a, b) => a - b);
    m.solve = { lvl, idx, filled: [], used: [], bank: shuffle(idx.map(i => words[i])) };
  }
  const s = m.solve;
  const html = words.map((w, i) => { const bi = s.idx.indexOf(i); if (bi < 0) return esc(w); const f = s.filled[bi]; return `<span class="blank">${f ? esc(f) : '&nbsp;&nbsp;&nbsp;&nbsp;'}</span>`; }).join(' ');
  body.innerHTML = `<h2>Step 4: Fill the blanks</h2>${note}<div class="seg">${[1, 2, 3].map(l => `<button class="btn small ${s.lvl === l ? '' : 'ghost'}" data-lv="${l}">${['Easy', 'Medium', 'Hard'][l - 1]}</button>`).join('')}</div>
    <div class="verse">${html}</div><div>${s.bank.map((w, i) => `<span class="chip ${s.used.includes(i) ? 'used' : ''}" data-b="${i}">${esc(w)}</span>`).join('')}</div><div id="msg" style="min-height:28px"></div>`;
  body.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { m.lvl = +b.dataset.lv; m.solve = null; drawSteps(v); });
  body.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const i = +b.dataset.b; if (s.used.includes(i)) return;
    const want = words[s.idx[s.filled.length]];
    if (s.bank[i] === want) {
      s.filled.push(want); s.used.push(i);
      if (s.filled.length === s.idx.length) { if (s.lvl >= 3) { done(4); return; } m.lvl = s.lvl + 1; m.solve = null; }
      drawSteps(v);
    } else $('#msg').innerHTML = '<span class="bad">Not that one — try again.</span>';
  });
}

/* ---------- Kids games ---------- */
let gMode = null, gs = null;
const GAME_LIST = [
  ['order', '🧩', 'Word Order', 'Tap the words in the right order.'],
  ['match', '🔎', 'Which Verse Is It?', 'Read the words, pick the reference.'],
  ['missing', '❓', 'Missing Word', 'Pick the word that fits the blank.'],
  ['who', '🕵️', 'Who Am I?', 'Guess the Bible person from the clue.'],
  ['books', '📚', 'Books in Order', 'Put Bible books in the right order.'],
  ['testament', '⚖️', 'Old or New?', 'Is the book in the Old or New Testament?'],
  ['pairs', '🃏', 'Memory Match', 'Match each verse to its reference.']
];
function kidsGames(v) {
  if (!needProfile(v, 'kids')) return;
  if (!gMode) {
    v.innerHTML = profileBar('kids') + GAME_LIST.map(([k, i, n, d]) => `<div class="card gold"><h2>${i} ${n}</h2><p>${d}</p><button class="btn" data-g="${k}">Play</button></div>`).join('') + '<p class="muted">Verse games use the public-domain World English Bible.</p>';
    wireBar('kids'); v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { gMode = b.dataset.g; gs = null; render(); });
    return;
  }
  v.innerHTML = '<div class="card">Loading…</div>';
  const list = (SHINE.kids || {}).gameVerses || [];
  const fn = { order: gameOrder, match: gameMatch, missing: gameMissing, who: gameWho, books: gameBooks, testament: gameTestament, pairs: gamePairs }[gMode];
  fn(v, list).catch(() => { v.innerHTML = `<button class="btn ghost small" id="gb">← Games</button><div class="card">Could not load verses. Check your connection.</div>`; $('#gb').onclick = gBack; });
}
const gBack = () => { gMode = null; gs = null; render(); };
const gTop = '<button class="btn ghost small" id="gb">← Games</button>';
const nextBtn = () => { const a = $('#again'); a.style.display = 'inline-block'; a.onclick = () => { gs = null; render(); }; };
async function gameOrder(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) { const ref = pick(list); const words = (await webText(ref)).split(' '); gs = { ref, words, bank: shuffle(words.map((w, i) => ({ w, i }))), picked: [] }; }
  const left = gs.bank.filter(b => !gs.picked.includes(b)), done = gs.picked.length === gs.words.length;
  if (done && !gs.paid) { gs.paid = true; awardStars('kids', 2); }
  v.innerHTML = `${gTop}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse" style="min-height:60px">${gs.picked.map(p => esc(p.w)).join(' ') || '<span class="muted">Tap the first word…</span>'}</div></div>
    <div class="card">${left.map(b => `<span class="chip" data-w="${b.i}">${esc(b.w)}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">You did it! +2 ⭐</span>' : ''}</div>
    ${done ? '<button class="btn small" id="again">Next verse</button>' : '<button class="btn ghost small" id="undo">Undo</button>'}</div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-w]').forEach(c => c.onclick = () => {
    const b = gs.bank.find(x => x.i === +c.dataset.w);
    if (b.w === gs.words[gs.picked.length]) { gs.picked.push(b); gameOrder(v, list); } else $('#msg').innerHTML = '<span class="bad">Try a different word.</span>';
  });
  const u = $('#undo'); if (u) u.onclick = () => { gs.picked.pop(); gameOrder(v, list); };
  const a = $('#again'); if (a) a.onclick = () => { gs = null; render(); };
}
async function gameMatch(v, list) {
  if (list.length < 3) { v.innerHTML = '<div class="card">Add at least 3 game verses in data/shine.json.</div>'; return; }
  if (!gs) { const ref = pick(list); gs = { ref, text: await webText(ref), opts: shuffle([ref, ...shuffle(list.filter(r => r !== ref)).slice(0, 2)]), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><div class="verse">${esc(gs.text)}</div></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.ref) { gs.ok = true; awardStars('kids', 1); $('#msg').innerHTML = '<span class="good">Correct! +1 ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.</span>';
  });
}
async function gameMissing(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) {
    const ref = pick(list), words = (await webText(ref)).split(' ');
    const cand = words.map((w, i) => [w.replace(/[^\p{L}\p{N}]/gu, ''), i]).filter(([w]) => w.length > 3);
    const [ans, at] = cand.length ? pick(cand) : [words[0], 0];
    const pool = list.length ? [] : [];
    const others = shuffle(cand.map(c => c[0]).filter(w => w.toLowerCase() !== ans.toLowerCase())).slice(0, 2);
    while (others.length < 2) others.push(['love', 'grace', 'peace', 'light'][others.length]);
    gs = { ref, words, at, ans, opts: shuffle([ans, ...others]), ok: false };
  }
  const shown = gs.words.map((w, i) => i === gs.at ? '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>' : esc(w)).join(' ');
  v.innerHTML = `${gTop}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse">${shown}</div></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.ans) { gs.ok = true; awardStars('kids', 1); $('#msg').innerHTML = '<span class="good">Yes! +1 ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Try another word.</span>';
  });
}
async function gameWho(v) {
  const list = GAMES.whoAmI || [];
  if (!list.length) { v.innerHTML = '<div class="card">No questions yet.</div>'; return; }
  if (!gs) { const q = pick(list); gs = { q, opts: shuffle(q.options), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Who am I?</h2><p class="bigword">${esc(gs.q.clue)}</p></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.q.answer) { gs.ok = true; awardStars('kids', 1); $('#msg').innerHTML = '<span class="good">Yes, it is ' + esc(gs.q.answer) + '! +1 ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.</span>';
  });
}
async function gameBooks(v) {
  if (!gs) { const start = Math.floor(Math.random() * (BOOKS.length - 4)); const idx = shuffle([...Array(66).keys()]).slice(0, 4).sort((a, b) => a - b); gs = { order: idx, bank: shuffle(idx), picked: [] }; }
  const done = gs.picked.length === 4;
  if (done && !gs.paid) { gs.paid = true; awardStars('kids', 2); }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Which comes first?</h2><p class="muted">Tap the books in the order they appear in the Bible.</p><div class="verse">${gs.picked.map((i, n) => `${n + 1}. ${esc(BOOKS[i])}`).join('<br>') || '<span class="muted">Tap the first book…</span>'}</div></div>
    <div class="card">${gs.bank.filter(i => !gs.picked.includes(i)).map(i => `<span class="chip" data-i="${i}">${esc(BOOKS[i])}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">Great! +2 ⭐</span>' : ''}</div>${done ? '<button class="btn small" id="again">Next</button>' : ''}</div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-i]').forEach(c => c.onclick = () => {
    const i = +c.dataset.i;
    if (i === gs.order[gs.picked.length]) { gs.picked.push(i); gameBooks(v); } else $('#msg').innerHTML = '<span class="bad">Another book comes before that one.</span>';
  });
  const a = $('#again'); if (a) a.onclick = () => { gs = null; render(); };
}
async function gameTestament(v) {
  if (!gs) { const i = Math.floor(Math.random() * 66); gs = { i, ok: false }; }
  const ot = gs.i < 39;
  v.innerHTML = `${gTop}<div class="card gold"><h2>Old or New Testament?</h2><p class="bigword">${esc(BOOKS[gs.i])}</p></div><div class="card"><button class="btn ghost" data-o="OT">Old Testament</button><button class="btn ghost" data-o="NT">New Testament</button><div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if ((b.dataset.o === 'OT') === ot) { gs.ok = true; awardStars('kids', 1); $('#msg').innerHTML = '<span class="good">Right! +1 ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.</span>';
  });
}
async function gamePairs(v, list) {
  if (list.length < 3) { v.innerHTML = '<div class="card">Add at least 3 game verses in data/shine.json.</div>'; return; }
  if (!gs) {
    const refs = shuffle(list).slice(0, 3), cards = [];
    for (const r of refs) { const w = (await webText(r)).split(' ').slice(0, 5).join(' ') + '…'; cards.push({ id: uid(), pair: r, label: r }, { id: uid(), pair: r, label: w }); }
    gs = { cards: shuffle(cards), up: [], gone: [], moves: 0, paid: false };
  }
  const won = gs.gone.length === gs.cards.length;
  if (won && !gs.paid) { gs.paid = true; awardStars('kids', 3); }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Memory Match</h2><p class="muted">Match each reference to the start of its verse. Moves: ${gs.moves}</p></div><div class="card">${gs.cards.map(c => `<div class="memcard ${gs.up.includes(c.id) ? 'up' : ''} ${gs.gone.includes(c.id) ? 'gone' : ''}" data-c="${c.id}">${gs.up.includes(c.id) ? esc(c.label) : '⭐'}</div>`).join('')}
    <div id="msg" style="min-height:28px">${won ? '<span class="good">You matched them all! +3 ⭐</span>' : ''}</div>${won ? '<button class="btn small" id="again">Play again</button>' : ''}</div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
    const id = el.dataset.c; if (gs.up.includes(id) || gs.gone.includes(id) || gs.up.length >= 2) return;
    gs.up.push(id);
    if (gs.up.length === 2) {
      gs.moves++;
      const [a, b] = gs.up.map(x => gs.cards.find(c => c.id === x));
      gameRedraw(v, list);
      if (a.pair === b.pair) setTimeout(() => { gs.gone.push(a.id, b.id); gs.up = []; gameRedraw(v, list); }, 500);
      else setTimeout(() => { gs.up = []; gameRedraw(v, list); }, 900);
    } else gameRedraw(v, list);
  });
  const a = $('#again'); if (a) a.onclick = () => { gs = null; render(); };
}
const gameRedraw = (v, list) => { if (gMode === 'pairs') gamePairs(v, list); };

/* ---------- Group chat (Kids and Youth) ---------- */
const cleanText = (s, max) => String(s).replace(/(https?:\/\/\S+|www\.\S+)/gi, '[link removed]').replace(/\s+/g, ' ').trim().slice(0, max);
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function chatView(v, g) {
  const max = (CFG.chat || {}).maxLength || 280, mode = (CFG.chat || {})[g] || 'open';
  const p = curProfile(g), msgs = (S.chat[g] = S.chat[g] || []);
  const canPost = mode === 'open' || S.leader;
  const vis = msgs.filter(m => S.leader || !m.reported).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.time.localeCompare(b.time));
  v.innerHTML = `<div class="preview">Preview: messages are saved on this phone only until the shared chat is connected.</div>
    <div class="card gold"><h2>${g === 'kids' ? 'Kids' : 'Youth'} group chat</h2>
      <p class="muted">Be kind. No private messages. No links. Leaders can remove messages. ${mode === 'leaders-only' ? 'Leaders post here; kids can react.' : ''}</p>
      <button class="btn ghost small" id="ld">${S.leader ? 'Leader mode: ON (tap to turn off)' : 'Leader sign-in'}</button></div>
    ${canPost ? `<div class="card"><label for="cm">${S.leader ? 'Post as leader' : 'Message'}</label><textarea id="cm" maxlength="${max}" placeholder="Write something kind…"></textarea><button class="btn" id="cs">Send</button><div id="cmsg"></div></div>` : ''}
    <div class="card" id="clist">${vis.length ? vis.map(m => `<div class="msg ${m.pinned ? 'pinned' : ''}"><span class="who">${esc(m.name)}</span>${m.leader ? '<span class="lead">Leader</span>' : ''} <span class="muted">${new Date(m.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>${m.pinned ? ' 📌' : ''}${m.reported ? ' <span class="bad">reported</span>' : ''}
      <div>${esc(m.text)}</div><div>${['👍', '🙏', '😊'].map(e => `<button class="btn ghost small" data-re="${m.id}|${e}">${e} ${(m.re || {})[e] || ''}</button>`).join('')}
      ${S.leader ? `<button class="btn ghost small" data-pin="${m.id}">${m.pinned ? 'Unpin' : 'Pin'}</button><button class="btn ghost small" data-del="${m.id}">Delete</button>` : `<button class="btn ghost small" data-rep="${m.id}">Report</button>`}</div></div>`).join('') : '<span class="muted">No messages yet.</span>'}</div>`;
  $('#ld').onclick = async () => {
    if (S.leader) { S.leader = false; save(); return render(); }
    const h = (CFG.leaderPinSha256 || '').toLowerCase();
    if (!h) { alert('Leader sign-in is not set up yet. Set a leader PIN in data/config.json.'); return; }
    const pin = prompt('Leader PIN'); if (pin == null) return;
    if ((await sha256(pin)) === h) { S.leader = true; save(); render(); } else alert('That PIN is not right.');
  };
  const cs = $('#cs');
  if (cs) cs.onclick = () => {
    const text = cleanText($('#cm').value, max);
    if (!text) { $('#cmsg').innerHTML = '<span class="bad">Please write a message first.</span>'; return; }
    let name = S.leader ? 'Leader' : (p ? p.name : '');
    if (!name) { name = (prompt('Your first name') || '').trim().split(/\s+/)[0]; if (!name) return; }
    msgs.push({ id: uid(), name: name.slice(0, 20), text, time: new Date().toISOString(), leader: !!S.leader, re: {} }); save(); render();
  };
  v.querySelectorAll('[data-re]').forEach(b => b.onclick = () => { const [id, e] = b.dataset.re.split('|'); const m = msgs.find(x => x.id === id); m.re = m.re || {}; m.re[e] = (m.re[e] || 0) + 1; save(); render(); });
  v.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { if (confirm('Report this message to a leader?')) { msgs.find(x => x.id === b.dataset.rep).reported = true; save(); render(); } });
  v.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { const m = msgs.find(x => x.id === b.dataset.pin); m.pinned = !m.pinned; save(); render(); });
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this message?')) { S.chat[g] = msgs.filter(x => x.id !== b.dataset.del); save(); render(); } });
}

/* ---------- Shine text tabs ---------- */
const DEFAULT_LESSON = { kids: "This Sunday's lesson will be posted here.", youth: "This week's teaching will be posted here." };
const shineText = (key, field, dflt) => v => { const t = (SHINE[key] || {})[field]; v.innerHTML = `<div class="card ${field === 'news' ? 'red' : ''}"><p style="margin:0">${esc(t || dflt)}</p></div>`; };

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
  'home.today': homeToday, 'home.mv': homeMV, 'home.e4': homeE4,
  'prayer.signup': prayerSignup, 'prayer.schedule': prayerSchedule, 'prayer.requests': prayerRequests,
  'kids.verse': v => memorize(v, 'kids'), 'kids.games': kidsGames, 'kids.lesson': shineText('kids', 'lesson', DEFAULT_LESSON.kids),
  'kids.chat': v => chatView(v, 'kids'), 'kids.news': shineText('kids', 'news', 'No announcements right now. Check back soon!'), 'kids.me': v => profilesTab(v, 'kids'),
  'youth.verse': v => memorize(v, 'youth'), 'youth.lesson': shineText('youth', 'lesson', DEFAULT_LESSON.youth), 'youth.notes': v => notesView(v, 'youth'),
  'youth.chat': v => chatView(v, 'youth'), 'youth.news': shineText('youth', 'news', 'No announcements right now. Check back soon!'), 'youth.me': v => profilesTab(v, 'youth'),
  'bible.read': bibleRead, 'bible.find': bibleFind, 'bible.notes': v => notesView(v, 'bible')
};

/* ---------- start + member password ---------- */
function startApp() { $('#gate').hidden = true; $('#app').hidden = false; render(); }
(async function init() {
  CFG = Object.assign(CFG, (await getJson('data/config.json')) || {});
  SHINE = (await getJson('data/shine.json')) || SHINE; PRAYER = (await getJson('data/prayer.json')) || PRAYER;
  HOME = (await getJson('data/home.json')) || HOME; VOTD = (await getJson('data/votd.json')) || VOTD; GAMES = (await getJson('data/games.json')) || GAMES;
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
