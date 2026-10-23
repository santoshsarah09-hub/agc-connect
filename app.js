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
const KEYBASE = 'agc.connect.v2';
let KEY = KEYBASE;
const blank = () => ({ slots: {}, notes: [], lang: 'en', ver: {}, cache: {}, profiles: [], cur: {}, chat: { kids: [], youth: [] }, leader: false, teacher: { reports: {} } });
const loadState = () => {
  const b = blank();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}'), s = Object.assign(b, o && typeof o === 'object' ? o : {});
    ['notes', 'profiles'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    ['slots', 'ver', 'cache', 'cur'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    if (!s.chat || !Array.isArray(s.chat.kids) || !Array.isArray(s.chat.youth)) s.chat = { kids: [], youth: [] };
    s.profiles = s.profiles.filter(p => p && p.id && p.name).map(p => Object.assign({ stars: 0, learned: [], steps: {}, hw: {}, log: [] }, p));
    return s;
  } catch (e) { return blank(); }
};
let S = loadState();
const localSave = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- parent account (Firebase) ---------- */
let CLOUD = null, ME = null, syncErr = false, syncTimer = null;
const pack = () => ({ profiles: S.profiles, cur: S.cur, notes: S.notes });
function save() {
  localSave(); queueSync();
  if (CLOUD && ME) { clearTimeout(syncTimer); syncTimer = setTimeout(flushCloud, 800); }
}
async function flushCloud() {
  clearTimeout(syncTimer);
  if (!(CLOUD && ME)) return;
  try { await CLOUD.save(ME.uid, pack()); syncErr = false; } catch (e) { syncErr = true; }
}
async function makeFirebase(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [A, Au, F] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
  const app = A.initializeApp(cfg), auth = Au.getAuth(app), db = F.getFirestore(app);
  return {
    onAuth: cb => Au.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)),
    signUp: (e, p) => Au.createUserWithEmailAndPassword(auth, e, p),
    signIn: (e, p) => Au.signInWithEmailAndPassword(auth, e, p),
    signOut: () => Au.signOut(auth),
    reset: e => Au.sendPasswordResetEmail(auth, e),
    load: async uid => { const s = await F.getDoc(F.doc(db, 'accounts', uid)); return s.exists() ? s.data() : null; },
    save: (uid, data) => F.setDoc(F.doc(db, 'accounts', uid), Object.assign({}, data, { updatedAt: Date.now() }))
  };
}
const AUTH_MSG = {
  'auth/invalid-credential': 'That email or password is not right.', 'auth/wrong-password': 'That email or password is not right.',
  'auth/user-not-found': 'That email or password is not right.', 'auth/invalid-email': 'Please check the email address.',
  'auth/email-already-in-use': 'That email already has an account. Try signing in.', 'auth/weak-password': 'Please use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Please wait a few minutes and try again.', 'auth/network-request-failed': 'No connection. Please check your internet and try again.'
};
const authMsg = e => AUTH_MSG[(e && e.code) || ''] || 'Something went wrong. Please try again.';
function accountNote() {
  if (CLOUD && ME) return `<div class="preview" style="background:#e3f6e8;color:#14532d">Signed in as <b>${esc(ME.email)}</b>. Your family is saved to your account.${syncErr ? ' <b>Could not reach your account just now; changes are saved on this phone.</b>' : ''}</div>`;
  return '<div class="preview">Sign-in is not turned on yet, so profiles are saved on this phone only.</div>';
}

/* ---------- language: English / Nepali ---------- */
let LANG = 'en', NE = {};
try { LANG = localStorage.getItem('agc.lang') || ((navigator.language || '').toLowerCase().startsWith('ne') ? 'ne' : 'en'); } catch (e) {}
if (LANG !== 'ne') LANG = 'en';
const T = s => (LANG === 'ne' && NE[s]) || s;
const pickLang = (o, k) => !o ? '' : (LANG === 'ne' && o[k + '_ne']) ? o[k + '_ne'] : (o[k] || '');
function setLang(l) { LANG = l === 'ne' ? 'ne' : 'en'; try { localStorage.setItem('agc.lang', LANG); } catch (e) {} S.lang = LANG; save(); render(); }
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
let xlActive = false;
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('.langtog').forEach(b => { b.textContent = LANG === 'ne' ? 'English' : 'नेपाली'; b.setAttribute('aria-label', LANG === 'ne' ? 'Switch to English' : 'नेपालीमा हेर्नुहोस्. Switch to Nepali'); });
  if (LANG === 'en' && !xlActive) return;
  const root = document.body; if (!root) return;
  if (LANG === 'ne') xlActive = true;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(n.parentNode.nodeName) || n.parentNode.closest('[data-keep],.msg,.langtog') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n => {
    const cur = n.nodeValue, orig = (n.__tr !== undefined && n.__tr === cur) ? n.__en : cur, t = orig.trim();
    if (LANG === 'ne' && NE[t]) { n.__en = orig; n.__tr = orig.replace(t, NE[t]); n.nodeValue = n.__tr; }
    else if (n.__tr !== undefined && n.__tr === cur) { n.nodeValue = n.__en; n.__tr = undefined; }
  });
  document.querySelectorAll(ATTRS.map(a => '[' + a + ']').join(',')).forEach(el => ATTRS.forEach(a => {
    if (!el.hasAttribute(a) || el.closest('.langtog')) return;
    const cur = el.getAttribute(a), key = 'xl' + a, rec = el.__xl && el.__xl[a];
    const orig = rec && rec.tr === cur ? rec.en : cur;
    if (LANG === 'ne' && NE[orig]) { (el.__xl = el.__xl || {})[a] = { en: orig, tr: NE[orig] }; el.setAttribute(a, NE[orig]); }
    else if (rec && rec.tr === cur) { el.setAttribute(a, rec.en); delete el.__xl[a]; }
  }));
  if (LANG === 'en') xlActive = false;
}
let xlQueued = false;
if (window.MutationObserver) new MutationObserver(() => { if (xlQueued) return; xlQueued = true; requestAnimationFrame(() => { xlQueued = false; applyLang(); }); }).observe(document.body, { childList: true, subtree: true });

/* ---------- data ---------- */
let CFG = { versions: [], defaultVersion: { en: 'NASB1995', ne: 'NNRV' }, youversion: {}, chat: { kids: 'leaders-only', youth: 'open', maxLength: 280 } };
let SHINE = { kids: {}, youth: {} }, PRAYER = { months: [] }, HOME = {}, VOTD = { refs: [] }, GAMES = { whoAmI: [] };
const getJson = u => fetch(u, { cache: 'no-cache' }).then(r => r.json()).catch(() => null);

/* ---------- sections ---------- */
const SECTIONS = {
  home:   { label: 'Home',        icon: '🏠', tabs: [['today', 'Today'], ['mv', 'Mission & Vision'], ['e4', '4E']] },
  prayer: { label: 'Prayer',      icon: '🙏', tabs: [['chain', 'Prayer Chain']] },
  worship: { label: 'Worship',    icon: '🎵', tabs: [['songs', 'Songs'], ['news', 'Announcements'], ['cal', 'Calendar'], ['fellow', 'Fellowship']] },
  kids:   { label: 'Kids Shine',  icon: '🧒', tabs: [['verse', 'Memory Verse'], ['games', 'Games'], ['fun', 'Fun Zone'], ['lesson', 'Lesson'], ['hw', 'Assignments'], ['chat', 'Chat'], ['news', 'Announcements'], ['me', 'My Kids'], ['teach', 'Teacher']] },
  youth:  { label: 'Youth Shine', icon: '🔥', tabs: [['verse', 'Memory Verse'], ['games', 'Games'], ['fun', 'Fun Zone'], ['lesson', 'Teaching'], ['hw', 'Assignments'], ['notes', 'Notes'], ['chat', 'Chat'], ['news', 'Announcements'], ['me', 'My Profile'], ['teach', 'Teacher']] },
  bible:  { label: 'Bible',       icon: '📖', tabs: [['read', 'Read'], ['find', 'Find a Verse'], ['notes', 'My Notes']] },
  leaders: { label: 'Leaders',    icon: '🛡️', tabs: [['post', 'Post'], ['growth', 'Growth'], ['res', 'Resources'], ['lboard', 'Leader Board'], ['team', 'Team', 'admin'], ['fam', 'Families', 'admin']] }
};
let sec = 'home';
const tabOf = { home: 'today', prayer: 'chain', worship: 'songs', kids: 'verse', youth: 'verse', bible: 'read', leaders: 'post' };
let showTimer = null;
function goHome() { sec = 'home'; tabOf.home = 'today'; render(); window.scrollTo(0, 0); }

function render() {
  clearTimeout(showTimer); if (typeof stopFun === 'function') stopFun();
  $('#homebtn').hidden = (sec === 'home' && tabOf.home === 'today');
  $('#tabs').innerHTML = Object.entries(SECTIONS).map(([k, s]) => `<button data-s="${k}" class="${k === sec ? 'on' : ''}"><span>${s.icon}</span>${s.label}</button>`).join('');
  const shownTabs = SECTIONS[sec].tabs.filter(t => t[2] !== 'admin' || (HUB.me && HUB.me.admin));
  if (!shownTabs.some(t => t[0] === tabOf[sec])) tabOf[sec] = shownTabs[0][0];
  $('#inner').innerHTML = shownTabs.map(([k, l]) => `<button data-t="${k}" class="${k === tabOf[sec] ? 'on' : ''}">${l}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { sec = b.dataset.s; render(); window.scrollTo(0, 0); });
  $('#inner').querySelectorAll('button').forEach(b => b.onclick = () => { tabOf[sec] = b.dataset.t; render(); });
  $('#inner').hidden = shownTabs.length < 2;
  const v = $('#view'); v.innerHTML = ''; v.classList.toggle('flush', sec === 'prayer'); document.body.classList.toggle('flushpage', sec === 'prayer');
  const fn = VIEWS[sec + '.' + tabOf[sec]];
  fn ? fn(v) : (v.innerHTML = '<div class="card">Coming soon.</div>');
  applyLang();
  if (hubOn()) refreshBadge();
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
const REF_ALIAS = { Psalm: 'Psalms', 'Song of Songs': 'Song of Solomon', 'Song of Solomon': 'Song of Solomon' };
function bookIdx(raw) { // "Gen", "1 Cor", "Matt", "Psalm" ... -> index in BOOKS (or -1)
  const l = String(raw).replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase(), low = BOOKS.map(b => b.toLowerCase());
  let i = low.indexOf(l); if (i >= 0) return i;
  const al = REF_ALIAS[String(raw).trim()]; if (al) return BOOKS.indexOf(al);
  const SP = { phil: 'Philippians', php: 'Philippians', phm: 'Philemon', phlm: 'Philemon', ps: 'Psalms', pss: 'Psalms', song: 'Song of Solomon', sos: 'Song of Solomon', jas: 'James', jn: 'John', mt: 'Matthew', mk: 'Mark', lk: 'Luke', ex: 'Exodus', exo: 'Exodus', jud: 'Judges', jdg: 'Judges' };
  if (SP[l]) return BOOKS.indexOf(SP[l]);
  const hits = low.map((b, k) => b.startsWith(l) ? k : -1).filter(k => k >= 0);
  return hits.length === 1 ? hits[0] : -1;
}
function yvUrl(ref, v) {
  const base = 'https://www.bible.com/bible/' + v.yv + '/';
  const m = String(ref).trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?(?:\s*,.*)?$/);
  if (!m) return base + 'JHN.1.' + v.abbr;
  const i = bookIdx(m[1]);
  if (i < 0) return base + 'JHN.1.' + v.abbr;
  return base + USFM[i] + '.' + m[2] + (m[3] ? '.' + m[3] + (m[4] ? '-' + m[4] : '') : '') + '.' + v.abbr;
}
const encRef = s => encodeURIComponent(s).replace(/%3A/gi, ':');
async function showPassage(el, ref, ver) {
  const v = ver || curVersion();
  if (v.type === 'none') { el.innerHTML = `<p class="bad">${esc(v.note || 'This version is not connected yet.')}</p>`; return; }
  if (v.type === 'youversion') {
    el.innerHTML = `<a class="btn" href="${esc(yvUrl(ref, v))}" target="_blank" rel="noopener">📖 Read ${esc(ref)} in ${esc(v.name)} (YouVersion)</a><p class="muted">${esc(v.note || '')}</p>`; return;
  }
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
function pairSentences(o) {
  const split = s => String(s || '').trim().split(/(?<=[.!?])\s+/).map(x => x.replace(/^["“]+|["”]+$/g, '').trim()).filter(Boolean);
  const en = split((o || {}).en), ne = split((o || {}).ne);
  return en.map((s, i) => ({ en: s, ne: ne.length === en.length ? ne[i] : '' }));
}
function slidesData() {
  const s = [{ k: 'welcome', logo: true, en: HOME.tagline || '' }];
  pairSentences(HOME.mission).forEach(p => s.push({ k: 'mission', lab: 'Our Mission', en: p.en, ne: p.ne }));
  pairSentences(HOME.vision).forEach(p => s.push({ k: 'vision', lab: 'Our Vision', en: p.en, ne: p.ne }));
  if ((HOME.fourE || []).length) s.push({ k: 'e4', lab: 'The 4 E’s', list: HOME.fourE.map(e => e.icon + ' ' + e.name) });
  return s;
}
function showcaseHTML() {
  const sl = slidesData();
  return `<div class="showcase" id="showcase" role="region" aria-label="AGC mission and vision" tabindex="0">
    ${sl.map((s, i) => `<div class="slide ${i === 0 ? 'on' : ''}" aria-hidden="${i !== 0}">
      ${s.logo ? '<img class="slogo" src="assets/logo-full.png" alt="Awakening Generations Church">' : `<div class="lab">${esc(s.lab)}</div>`}
      ${s.list ? `<div class="e4list">${s.list.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : `<div class="txt" ${LANG === 'ne' && s.ne ? 'lang="ne" data-keep' : ''}>${esc(LANG === 'ne' && s.ne ? s.ne : s.en)}</div>`}
      ${LANG === 'ne' && !s.ne && (s.k === 'mission' || s.k === 'vision') ? '<div class="nenote">Nepali text has not been added yet.</div>' : ''}
      </div>`).join('')}
    <div class="dots">${sl.map((s, i) => `<button class="dot ${i === 0 ? 'on' : ''}" aria-label="Slide ${i + 1} of ${sl.length}"></button>`).join('')}</div></div>`;
}
async function fillNews() {
  const box = $('#newsbox'); if (!box || !hubOn()) return;
  const f = await hubFeed(); const box2 = $('#newsbox'); if (!box2 || !f) return;
  const top = (f.announcements || []).filter(a => !a.scope || a.scope === 'all' || a.scope === 'worship').slice(0, 2);
  const nxt = (f.events || []).filter(e => e.date >= todayKey() && (!e.area || e.area === 'all' || e.area === 'worship')).slice(0, 1);
  if (!top.length && !nxt.length) return;
  box2.innerHTML = `<div class="card gold"><h2>What's new</h2>${top.map(a => `<p><b>${esc(pickLang(a, 'title') || a.en || a.ne)}</b></p>`).join('')}${nxt.map(e => `<p>📅 ${esc(LANG === 'ne' && e.ne ? e.ne : e.en || e.ne)} · ${esc(fmtLong(e.date))} ${esc(fmtTime(e.time))}</p>`).join('')}<button class="btn small" id="newsgo">See Worship</button></div>`;
  $('#newsgo').onclick = () => { sec = 'worship'; tabOf.worship = 'news'; render(); window.scrollTo(0, 0); };
}
const tilesHTML = () => `<div id="newsbox"></div><div class="tiles">${[['prayer', '🙏', 'Prayer Chain', 't1'], ['worship', '🎵', 'Worship', 't5'], ['kids', '🧒', 'Kids Shine', 't2'], ['youth', '🔥', 'Youth Shine', 't3'], ['bible', '📖', 'Bible', 't4'], ['leaders', '🛡️', 'AGC Leaders', 't6']].map(([k, i, n, c]) => `<button class="tile ${c}" data-go="${k}"><span>${i}</span>${n}</button>`).join('')}</div>`;
function wireShowcase(v) {
  v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sec = b.dataset.go; render(); window.scrollTo(0, 0); });
  const box = $('#showcase', v); if (!box) return;
  const slides = [...box.querySelectorAll('.slide')], dots = [...box.querySelectorAll('.dot')];
  let i = 0;
  const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dwell = el => 2800 + 240 * ((el.textContent || '').trim().split(/\s+/).length);
  const queue = () => { clearTimeout(showTimer); if (calm || slides.length < 2) return; showTimer = setTimeout(() => { if (document.hidden) queue(); else show(i + 1); }, dwell(slides[i])); };
  const show = n => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    queue();
  };
  dots.forEach((d, k) => d.onclick = e => { e.stopPropagation(); show(k); });
  box.onclick = () => show(i + 1);
  box.onkeydown = e => { if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); };
  queue();
}
async function weeklyScripture() {
  const now = new Date(), dow = now.getDay(), sun = dateKey(addDays(now, dow ? 7 - dow : 0));
  let list = []; try { const f = await hubFeed(); if (f && f.preaching && f.preaching.length) list = f.preaching; } catch (e) { list = []; }
  if (!list.length) { const j = await getJson('data/preaching.json'); list = (j && j.weeks) || []; }
  return list.find(x => x.date === sun) || null;
}
async function homeToday(v) {
  v.innerHTML = `<button type="button" class="askhero" id="askhero"><span class="askhero-i">💬</span><span><b>Ask Pastor Santosh</b><small>Type or speak a question and get a prepared answer</small></span></button>${showcaseHTML()}${tilesHTML()}
    <div class="card votd"><div class="muted" id="vhead">Verse of the Day</div><div class="ref" id="vref" style="font-size:22px">Loading…</div><div id="vtitle"></div>
      <div class="votd-lang">English</div><div id="ven"></div>
      <div class="votd-lang">नेपाली</div><div id="vne"></div>
      <p class="muted" id="vsrc"></p></div>`;
  wireShowcase(v); fillNews(); $('#askhero').onclick = askOpen;
  const wk = await weeklyScripture(), ref = wk ? wk.ref : await votdRef();
  if (!ref) { $('#vref').textContent = '—'; return; }
  if (wk) { $('#vhead').textContent = "This Sunday's Scripture"; $('#vtitle').innerHTML = `<p><b>${esc(wk.title)}</b>${wk.theme ? ` <span class="muted">· ${esc(wk.theme)}</span>` : ''}</p>`; applyLang(); }
  $('#vref').textContent = ref;
  const en = usableVer('en'), ne = usableVer('ne');
  showPassage($('#ven'), ref, en.v);
  showPassage($('#vne'), ref, ne.v).then(() => { if (ne.note) $('#vne').insertAdjacentHTML('afterbegin', `<p class="muted">${esc(ne.note)}</p>`); });
  $('#vsrc').textContent = wk ? 'From the church preaching calendar. The sermon is on this Sunday.' : (CFG.youversion || {}).appKey ? 'Passage chosen by YouVersion.' : 'Today\'s passage is picked from the church list.';
}
function ref2chips(refs) { return refs.map(r => `<span class="refchip" data-r="${esc(r)}">${esc(r)}</span>`).join(''); }
function wireChips(el, out) {
  el.querySelectorAll('[data-r]').forEach(c => c.onclick = () => { out.hidden = false; showPassage(out, c.dataset.r, usableVer('en').v); });
}
function homeMV(v) {
  const box = (title, o, cls) => { o = o || {}; const useNe = LANG === 'ne' && o.ne; return `<div class="card ${cls}"><h2>${title}</h2><p ${useNe ? 'lang="ne" data-keep' : ''}>${esc(useNe ? o.ne : o.en)}</p>${LANG === 'ne' && !o.ne ? '<p class="muted">Nepali text has not been added yet.</p>' : ''}</div>`; };
  v.innerHTML = box('Our Mission', HOME.mission, 'gold') + box('Our Vision', HOME.vision, 'red') +
    `<div class="card"><h2>${esc(HOME.tagline || '')}</h2><p class="muted">Equip • Evangelize • Exalt • Edify</p></div>`;
}
function homeE4(v) {
  const list = HOME.fourE || [];
  v.innerHTML = list.map((e, i) => `<div class="card e4" style="border-top-color:${esc(e.color)}"><h2>${esc(e.icon)} ${esc(e.name)}</h2><p ${LANG === 'ne' && e.ne ? 'lang="ne" data-keep' : ''}>${esc(LANG === 'ne' && e.ne ? e.ne : e.en)}</p><div>${ref2chips(e.refs || [])}</div><div class="out" hidden></div></div>`).join('');
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
  v.innerHTML = `${CLOUD && ME ? '' : '<div class="preview">Notes are saved on this phone only.</div>'}<button class="btn" id="nn">+ New note</button>
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

window.addEventListener('message', e => { if (e.origin !== location.origin || !e.data || e.data.agc !== 'pfull') return; const f = $('#pframe'); if (f) f.classList.toggle('pfull', !!e.data.on); });
function prayerEmbed(v) {
  v.innerHTML = '<iframe class="pframe" id="pframe" title="Prayer Chain" src="prayer/index.html?embed=1" loading="eager" allow="fullscreen" allowfullscreen></iframe>';
  const f = $('#pframe'), fit = () => { if (!f.isConnected) return window.removeEventListener('resize', fit); f.style.height = Math.max(320, window.innerHeight - f.getBoundingClientRect().top - $('#tabs').offsetHeight) + 'px'; };
  fit(); window.addEventListener('resize', fit); setTimeout(fit, 300);
}

/* ---------- profiles (add a child / youth profile) ---------- */
const profilesOf = g => S.profiles.filter(p => p.group === g);
function curProfile(g) { return S.profiles.find(p => p.id === S.cur[g] && p.group === g) || profilesOf(g)[0] || null; }
function awardStars(g, n) { const p = curProfile(g); if (p) { p.stars += n; logAct(p, 'game', '', n); save(); } }
// A wrong answer costs 1 star, once per question, and never takes the week's balance below zero.
function missStar(g, key) {
  const p = curProfile(g); if (!p || !key) return false;
  if (missStar.k === key) return false; missStar.k = key;
  if (typeof starBal !== 'function' || starBal(p) < 1) return false;
  p.stars = Math.max(0, p.stars - 1); logAct(p, 'miss', '', -1); save(); return true;
}
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
    const p = { id: uid(), name: name.slice(0, 20), group: g, age: g === 'kids' ? $('#pa').value : 'older', stars: 0, learned: [], steps: {}, hw: {}, log: [] };
    S.profiles.push(p); S.cur[g] = p.id; save(); render();
  };
}
function profileBar(g) {
  const list = profilesOf(g), p = curProfile(g);
  return `<div class="pbar"><b>${esc(p.name)}</b><span>⭐ ${starBal(p)}</span><span class="muted">${p.learned.length} verse${p.learned.length === 1 ? '' : 's'} learned</span>
    ${list.length > 1 ? `<select id="pswitch" aria-label="Switch ${g === 'kids' ? 'child' : 'profile'}">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div>`;
}
function wireBar(g) { const s = $('#pswitch'); if (s) s.onchange = e => { S.cur[g] = e.target.value; save(); render(); }; }
function needProfile(v, g) {
  if (curProfile(g)) return curProfile(g);
  v.innerHTML = addForm(g); wireAdd(g); return null;
}
function profilesTab(v, g) {
  const list = profilesOf(g);
  v.innerHTML = `${accountNote()}
    ${list.length ? `<div class="card"><h2>${g === 'kids' ? 'Your children' : 'Profiles'}</h2>${list.map(p => `<div class="slot"><div class="t">${esc(p.name)} <span class="muted">${g === 'kids' ? (p.age === 'younger' ? 'Younger' : 'Older') + ' · ' : ''}⭐ ${p.stars} · ${p.learned.length} learned</span></div>
      <button class="btn small ${p.id === (curProfile(g) || {}).id ? '' : 'ghost'}" data-s="${p.id}">${p.id === (curProfile(g) || {}).id ? 'Active' : 'Switch'}</button>
      <button class="btn small ghost" data-x="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button></div>`).join('')}</div>` : ''}
    ${list.length ? weekCard(list) : ''}
    ${list.length && hubOn() ? famCard(list) : ''}
    ${list.length && hubOn() ? syncCard(list) : ''}
    ${addForm(g)}`;
  wireAdd(g); wireWeek(v); wireSync(v, g); wireFam(v, g);
  v.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.cur[g] = b.dataset.s; save(); render(); });
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    if (!confirm('Remove this profile and its progress from this phone?')) return;
    const gone = S.profiles.find(p => p.id === b.dataset.x); if (gone && gone.sync && hubOn()) hubCall({ action: 'progForget', childId: gone.id, deviceId: deviceId() }).catch(() => {});
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
  if (!a.includes(id)) { a.push(id); logAct(p, 'step', ref + ' ' + id, 0); }
  let all = false;
  if (STEPS.every(s => a.includes(s[0])) && !p.learned.includes(ref)) { p.learned.push(ref); p.stars += 5; logAct(p, 'learned', ref, 5); all = true; }
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
  const note = m.t.fallback ? `<p class="muted">The ${esc(m.t.want)} text for this verse has not been added yet, so this shows the World English Bible. A leader can add it in Teacher, under the weekly verse.</p>` : `<p class="muted">${esc(m.t.label)}${/NASB/i.test(m.t.label) ? '. Scripture quotations are from the New American Standard Bible® (NASB 1995), © The Lockman Foundation. Used by permission.' : ''}</p>`;
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
    } else $('#msg').innerHTML = '<span class="bad">Not that one — try again.' + (missStar(m.g || 'kids', 'fill|' + m.ref + '|' + s.lvl + '|' + s.filled.length) ? ' −1 ⭐' : '') + '</span>';
  });
}

/* ---------- Kids and Youth games ---------- */
let gMode = null, gs = null, gG = 'kids';
const GP = n => gG === 'youth' ? n + 1 : n;   // Youth games are harder, so they pay one more star
const GAME_LIST = [
  ['order', '🧩', 'Word Order', 'Tap the words in the right order.'],
  ['match', '🔎', 'Which Verse Is It?', 'Read the words, pick the reference.'],
  ['missing', '❓', 'Missing Word', 'Pick the word that fits the blank.'],
  ['who', '🕵️', 'Who Am I?', 'Guess the Bible person from the clue.'],
  ['books', '📚', 'Books in Order', 'Put Bible books in the right order.'],
  ['testament', '⚖️', 'Old or New?', 'Is the book in the Old or New Testament?'],
  ['pairs', '🃏', 'Memory Match', 'Match each verse to its reference.'],
  ['count', '🔢', 'Count the Animals', 'Count the animals going into the ark.'],
  ['tf', '✅', 'True or False', 'Is the Bible fact true or false?'],
  ['whodid', '🙋', 'Who Did It?', 'Who built the ark? Who met the giant?'],
  ['picture', '🖼️', 'Picture Story', 'Which Bible story does the picture show?'],
  ['spell', '🔤', 'Spell It', 'Tap the letters to spell a Bible word.']
];
const kidsGames = v => gamesView(v, 'kids'), youthGames = v => gamesView(v, 'youth');
const YOUTH_GAME_LIST = [
  ['order', '🧩', 'Verse Builder', 'Put a whole verse back in order. Longer verses, more stars.'],
  ['match', '🔎', 'Name That Verse', 'Read the words, pick the right reference.'],
  ['missing', '❓', 'Missing Word', 'Five choices, one right word.'],
  ['type', '⌨️', 'Type the Word', 'No choices. Type the missing word yourself.'],
  ['rush', '⏱️', 'Verse Rush', '60 seconds. Name as many verses as you can.'],
  ['who', '🕵️', 'Who Am I?', 'Guess the Bible person from five names.'],
  ['books', '📚', 'Books in Order', 'Put six Bible books in the right order.'],
  ['section', '🗂️', 'Which Section?', 'Law, History, Poetry, Prophets, Gospels or Letters?'],
  ['pairs', '🃏', 'Memory Match', 'Match five verses to their references.']
];
function gamesView(v, g) {
  if (gG !== g) { gG = g; gMode = null; gs = null; }
  if (!needProfile(v, g)) return;
  if (!gMode) {
    v.innerHTML = profileBar(g) + '<div class="card gold"><h2>Pick a game</h2><div class="bubs">' + (g === 'youth' ? YOUTH_GAME_LIST : GAME_LIST).map(([k, i, n, d]) => `<button class="bub" data-g="${k}" title="${esc(d)}"><span class="bi">${i}</span><span class="bn">${n}</span></button>`).join('') + '</div><p class="muted" id="gdesc">Tap a bubble to play.</p></div>' + '<p class="muted">Verse games use the public-domain World English Bible.</p>';
    wireBar(g); const GL = g === 'youth' ? YOUTH_GAME_LIST : GAME_LIST; v.querySelectorAll('[data-g]').forEach(b => { b.onfocus = b.onmouseenter = () => { const e = GL.find(x => x[0] === b.dataset.g); if (e && $('#gdesc')) $('#gdesc').textContent = e[2] + ': ' + e[3]; }; b.onclick = () => { gMode = b.dataset.g; gs = null; render(); }; });
    return;
  }
  v.innerHTML = '<div class="card">Loading…</div>';
  const list = (SHINE[g] || {}).gameVerses || [];
  const fn = { order: gameOrder, match: gameMatch, missing: gameMissing, who: gameWho, books: gameBooks, testament: gameTestament, pairs: gamePairs, section: gameSection, rush: gameRush, type: gameType, count: gameCount, tf: gameTF, whodid: gameWhoDid, picture: gamePicture, spell: gameSpell }[gMode];
  fn(v, list).catch(() => { v.innerHTML = `<button class="btn ghost small" id="gb">← Games</button><div class="card">Could not load verses. Check your connection.</div>`; $('#gb').onclick = gBack; });
}
const gBack = () => { gMode = null; gs = null; render(); };
const gTop = '<button class="btn ghost small" id="gb">← Games</button>';
const nextBtn = () => { const a = $('#again'); a.style.display = 'inline-block'; a.onclick = () => { gs = null; render(); }; };
async function gameOrder(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) { const ref = pick(list); const words = (await webText(ref)).split(' '); gs = { ref, words, bank: shuffle(words.map((w, i) => ({ w, i }))), picked: [] }; }
  const left = gs.bank.filter(b => !gs.picked.includes(b)), done = gs.picked.length === gs.words.length;
  if (done && !gs.paid) { gs.paid = true; awardStars(gG, GP(2)); }
  v.innerHTML = `${gTop}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse" style="min-height:60px">${gs.picked.map(p => esc(p.w)).join(' ') || '<span class="muted">Tap the first word…</span>'}</div></div>
    <div class="card">${left.map(b => `<span class="chip" data-w="${b.i}">${esc(b.w)}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">You did it! +' + GP(2) + ' ⭐</span>' : ''}</div>
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
    if (b.dataset.o === gs.ref) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Correct! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  });
}
async function gameMissing(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) {
    const ref = pick(list), words = (await webText(ref)).split(' ');
    const cand = words.map((w, i) => [w.replace(/[^\p{L}\p{N}]/gu, ''), i]).filter(([w]) => w.length > 3);
    const [ans, at] = cand.length ? pick(cand) : [words[0], 0];
    const pool = list.length ? [] : [];
    const others = shuffle(cand.map(c => c[0]).filter(w => w.toLowerCase() !== ans.toLowerCase())).slice(0, gG === 'youth' ? 4 : 2);
    while (others.length < (gG === 'youth' ? 4 : 2)) others.push(['love', 'grace', 'peace', 'light', 'mercy', 'truth'][others.length]);
    gs = { ref, words, at, ans, opts: shuffle([ans, ...others]), ok: false };
  }
  const shown = gs.words.map((w, i) => i === gs.at ? '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>' : esc(w)).join(' ');
  v.innerHTML = `${gTop}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse">${shown}</div></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.ans) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Try another word.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  });
}
async function gameWho(v) {
  const list = GAMES.whoAmI || [];
  if (!list.length) { v.innerHTML = '<div class="card">No questions yet.</div>'; return; }
  if (!gs) { const q = pick(list); gs = { q, opts: shuffle(gG === 'youth' ? [...q.options, ...shuffle(list.filter(x => x !== q).map(x => x.answer)).filter(a => !q.options.includes(a)).slice(0, 2)] : q.options), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Who am I?</h2><p class="bigword">${esc(gs.q.clue)}</p></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === gs.q.answer) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes, it is ' + esc(gs.q.answer) + '! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  });
}
async function gameBooks(v) {
  if (!gs) { const start = Math.floor(Math.random() * (BOOKS.length - 4)); const idx = shuffle([...Array(66).keys()]).slice(0, gG === 'youth' ? 6 : 4).sort((a, b) => a - b); gs = { order: idx, bank: shuffle(idx), picked: [] }; }
  const done = gs.picked.length === gs.order.length;
  if (done && !gs.paid) { gs.paid = true; awardStars(gG, GP(2)); }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Which comes first?</h2><p class="muted">Tap the books in the order they appear in the Bible.</p><div class="verse">${gs.picked.map((i, n) => `${n + 1}. ${esc(BOOKS[i])}`).join('<br>') || '<span class="muted">Tap the first book…</span>'}</div></div>
    <div class="card">${gs.bank.filter(i => !gs.picked.includes(i)).map(i => `<span class="chip" data-i="${i}">${esc(BOOKS[i])}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">Great! +' + GP(2) + ' ⭐</span>' : ''}</div>${done ? '<button class="btn small" id="again">Next</button>' : ''}</div>`;
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
    if ((b.dataset.o === 'OT') === ot) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Right! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  });
}
async function gamePairs(v, list) {
  if (list.length < 3) { v.innerHTML = '<div class="card">Add at least 3 game verses in data/shine.json.</div>'; return; }
  if (!gs) {
    const refs = shuffle(list).slice(0, gG === 'youth' ? 5 : 3), cards = [];
    for (const r of refs) { const w = (await webText(r)).split(' ').slice(0, 5).join(' ') + '…'; cards.push({ id: uid(), pair: r, label: r }, { id: uid(), pair: r, label: w }); }
    gs = { cards: shuffle(cards), up: [], gone: [], moves: 0, paid: false };
  }
  const won = gs.gone.length === gs.cards.length;
  if (won && !gs.paid) { gs.paid = true; awardStars(gG, GP(3)); }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Memory Match</h2><p class="muted">Match each reference to the start of its verse. Moves: ${gs.moves}</p></div><div class="card">${gs.cards.map(c => `<div class="memcard ${gs.up.includes(c.id) ? 'up' : ''} ${gs.gone.includes(c.id) ? 'gone' : ''}" data-c="${c.id}">${gs.up.includes(c.id) ? esc(c.label) : '⭐'}</div>`).join('')}
    <div id="msg" style="min-height:28px">${won ? '<span class="good">You matched them all! +' + GP(3) + ' ⭐</span>' : ''}</div>${won ? '<button class="btn small" id="again">Play again</button>' : ''}</div>`;
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
const BSECT = [['Law', 0, 4], ['History', 5, 16], ['Poetry & Wisdom', 17, 21], ['Prophets', 22, 38], ['Gospels & Acts', 39, 43], ['Letters', 44, 64]];
const sectOf = i => (BSECT.find(([, a, b]) => i >= a && i <= b) || [])[0];
async function gameSection(v) {
  if (!gs) { let i; do { i = Math.floor(Math.random() * 65); } while (!sectOf(i)); gs = { i, ok: false }; }
  const right = sectOf(gs.i);
  v.innerHTML = `${gTop}<div class="card gold"><h2>Which section of the Bible?</h2><p class="bigword">${esc(BOOKS[gs.i])}</p></div><div class="card">${BSECT.map(([n]) => `<button class="btn ghost" data-o="${esc(n)}">${esc(n)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    if (gs.ok) return;
    if (b.dataset.o === right) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes! ' + esc(BOOKS[gs.i]) + ' is in ' + esc(right) + '. +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  });
}
async function gameType(v, list) {
  if (!list.length) { v.innerHTML = '<div class="card">No game verses yet.</div>'; return; }
  if (!gs) {
    const ref = pick(list), words = (await webText(ref)).split(' ');
    const cand = words.map((w, i) => [w.replace(/[^\p{L}\p{N}]/gu, ''), i]).filter(([w]) => w.length > 3), [ans, at] = cand.length ? pick(cand) : [words[0], 0];
    gs = { ref, words, at, ans, ok: false };
  }
  const shown = gs.words.map((w, i) => i === gs.at ? '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>' : esc(w)).join(' ');
  v.innerHTML = `${gTop}<div class="card gold"><div class="ref">${esc(gs.ref)}</div><div class="verse">${shown}</div></div><div class="card"><input id="tw" type="text" autocomplete="off" autocapitalize="none" placeholder="Type the missing word" aria-label="Missing word" style="width:100%;font-size:18px;padding:10px;border-radius:10px;border:1px solid #c9d3e0"><div class="seg" style="margin-top:8px"><button class="btn" id="tg">Check</button><button class="btn ghost small" id="ts">Hint</button></div><div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  const chk = () => {
    if (gs.ok) return; const a = $('#tw').value.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); if (!a) return;
    if (a === gs.ans.toLowerCase()) { gs.ok = true; awardStars(gG, GP(2) - (gs.hint ? 1 : 0)); $('#msg').innerHTML = '<span class="good">Yes, “' + esc(gs.ans) + '”! +' + (GP(2) - (gs.hint ? 1 : 0)) + ' ⭐</span>'; nextBtn(); }
    else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>';
  };
  $('#tg').onclick = chk; $('#tw').onkeydown = e => { if (e.key === 'Enter') chk(); };
  $('#ts').onclick = () => { gs.hint = 1; $('#msg').innerHTML = '<span class="muted">Starts with “' + esc(gs.ans.charAt(0)) + '” and has ' + gs.ans.length + ' letters. (Hint costs 1 ⭐ of the prize.)</span>'; };
}
async function gameRush(v, list) {
  if (list.length < 4) { v.innerHTML = '<div class="card">Add at least 4 game verses in data/shine.json.</div>'; return; }
  const G0 = gs = { rush: true, score: 0, wrong: 0, tm: 60, done: false, paid: false }, gen = (window.__rushGen = (window.__rushGen || 0) + 1);
  const alive = () => v.isConnected && gs === G0 && window.__rushGen === gen;
  v.innerHTML = `${gTop}<div class="card gold"><h2>⏱️ Verse Rush</h2><p>Name the verse before the 60 seconds run out. Each right answer is a point. Earn 1 ⭐ for every 2 points, up to 8 ⭐.</p><button class="btn" id="rs">Start</button></div>`;
  $('#gb').onclick = () => { window.__rushGen++; gBack(); };
  $('#rs').onclick = async () => {
    let tick = null;
    const finish = () => { clearInterval(tick); if (!alive() || G0.done) return; G0.done = true; const stars = Math.min(8, Math.floor(G0.score / 2)); if (stars) awardStars(gG, stars); v.innerHTML = `${gTop}<div class="card gold"><h2>⏱️ Time!</h2><p class="bigword">${G0.score} right</p><p>${stars ? '<span class="good">+' + stars + ' ⭐</span>' : 'Get 2 right to earn a star. Try again!'}</p><button class="btn" id="ra">Play again</button></div>`; $('#gb').onclick = gBack; $('#ra').onclick = () => { gs = null; render(); }; };
    const ask = async () => {
      if (!alive() || G0.done) return;
      let ref, text; try { ref = pick(list); text = await webText(ref); } catch (e) { v.innerHTML = '<div class="card">Could not load verses. Check your connection.</div>'; return; }
      if (!alive() || G0.done) return;
      const opts = shuffle([ref, ...shuffle(list.filter(r => r !== ref)).slice(0, 3)]), short = text.split(' ').slice(0, 22).join(' ') + (text.split(' ').length > 22 ? '…' : '');
      v.innerHTML = `${gTop}<div class="card gold"><p>Points: <b>${G0.score}</b> · ⏱ <b id="rt">${G0.tm}</b>s</p><div class="verse">${esc(short)}</div></div><div class="card">${opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:24px"></div></div>`;
      $('#gb').onclick = () => { window.__rushGen++; clearInterval(tick); gBack(); };
      v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (G0.done) return; if (b.dataset.o === ref) { G0.score++; ask(); } else { G0.tm = Math.max(0, G0.tm - 5); if (G0.tm <= 0) return finish(); b.disabled = true; $('#msg').innerHTML = '<span class="bad">Not that one. −5 seconds</span>'; } });
    };
    tick = setInterval(() => { if (!alive()) return clearInterval(tick); G0.tm--; const el = $('#rt'); if (el) el.textContent = Math.max(0, G0.tm); if (G0.tm <= 0) finish(); }, 1000);
    ask();
  };
}
const KTF = [['Noah built an ark.', 1], ['David fought Goliath with a sword.', 0], ['Jesus was born in Bethlehem.', 1], ['Jonah was swallowed by a big fish.', 1], ['God made the world in two days.', 0], ['Moses led God’s people through the Red Sea.', 1],
  ['Daniel was put in a den of lions.', 1], ['Jesus had twelve disciples.', 1], ['Zacchaeus climbed a tree to see Jesus.', 1], ['Adam was the first man God made.', 1], ['The walls of Jericho were made of ice.', 0], ['Joseph’s father gave him a special coat.', 1],
  ['A dove brought Noah an olive leaf.', 1], ['Samuel was a king who built the temple.', 0], ['The Bible says to love your neighbor.', 1], ['Jesus was born in a big castle.', 0]];
const KWHO = [['Who built the ark?', 'Noah', ['Moses', 'David']], ['Who was swallowed by a big fish?', 'Jonah', ['Daniel', 'Samuel']], ['Who defeated Goliath?', 'David', ['Joseph', 'Moses']], ['Who was thrown into the lions’ den?', 'Daniel', ['Jonah', 'Noah']],
  ['Who led God’s people through the Red Sea?', 'Moses', ['Noah', 'Adam']], ['Who was the first man?', 'Adam', ['Noah', 'David']], ['Who was Jesus’ mother?', 'Mary', ['Ruth', 'Esther']], ['Who climbed a tree to see Jesus?', 'Zacchaeus', ['Daniel', 'Samuel']],
  ['Who had a special coat from his father?', 'Joseph', ['Moses', 'Jonah']], ['Who became queen and helped save her people?', 'Esther', ['Ruth', 'Mary']], ['Who heard God call his name at night?', 'Samuel', ['David', 'Jonah']], ['Who stayed with Naomi and said “Where you go, I will go”?', 'Ruth', ['Esther', 'Mary']]];
const KSPELL = ['JESUS', 'NOAH', 'DAVID', 'MOSES', 'JONAH', 'LOVE', 'FAITH', 'GRACE', 'PRAYER', 'BIBLE', 'ANGEL', 'SHEEP', 'DANIEL', 'ARK'];
async function gameCount(v) {
  if (!gs) { const em = pick(['🐘', '🦒', '🐑', '🦁', '🐫', '🐢', '🦓', '🐻']), n = 2 + Math.floor(Math.random() * 8), set = new Set([n]); while (set.size < 4) { const x = n + (Math.random() < .5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3)); if (x > 0) set.add(x); } gs = { em, n, opts: shuffle([...set]), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>How many animals are going into the ark?</h2><p style="font-size:34px;line-height:1.3;margin:6px 0">${gs.em.repeat(gs.n)}</p></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${o}" style="min-width:64px;font-size:20px">${o}</button>`).join(' ')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (gs.ok) return; if (+b.dataset.o === gs.n) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes, ' + gs.n + '! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Count again!' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>'; });
}
async function gameTF(v) {
  if (!gs) { const [t, a] = pick(KTF); gs = { t, a, ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>True or false?</h2><p class="bigword">${esc(gs.t)}</p></div><div class="card"><button class="btn ghost" data-o="1">✅ True</button><button class="btn ghost" data-o="0">❌ False</button><div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (gs.ok) return; if (+b.dataset.o === gs.a) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Right! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try the other one.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>'; });
}
async function gameWhoDid(v) {
  if (!gs) { const [q, a, o] = pick(KWHO); gs = { q, a, opts: shuffle([a, ...o]), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Who did it?</h2><p class="bigword">${esc(gs.q)}</p></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (gs.ok) return; if (b.dataset.o === gs.a) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes, ' + esc(gs.a) + '! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>'; });
}
async function gamePicture(v) {
  if (!gs) { const [e, n] = pick(MEMPAIRS), others = shuffle(MEMPAIRS.filter(x => x[1] !== n).filter(x => !/Psalm|Genesis/.test(x[1])).map(x => x[1])).slice(0, 2); gs = { e, n, opts: shuffle([n, ...others]), ok: false }; }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Which Bible story or person?</h2><p style="font-size:64px;text-align:center;margin:6px 0">${gs.e}</p></div><div class="card">${gs.opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<div id="msg" style="min-height:28px"></div><button class="btn small" id="again" style="display:none">Next</button></div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (gs.ok) return; if (b.dataset.o === gs.n) { gs.ok = true; awardStars(gG, GP(1)); $('#msg').innerHTML = '<span class="good">Yes, ' + esc(gs.n) + '! +' + GP(1) + ' ⭐</span>'; nextBtn(); } else $('#msg').innerHTML = '<span class="bad">Not quite — try again.' + (missStar(gG, gs) ? ' −1 ⭐' : '') + '</span>'; });
}
async function gameSpell(v) {
  if (!gs) { const w = pick(KSPELL); gs = { w, bank: shuffle(w.split('').map((c, i) => ({ c, i }))), picked: [] }; }
  const done = gs.picked.length === gs.w.length;
  if (done && !gs.paid) { gs.paid = true; awardStars(gG, GP(2)); }
  v.innerHTML = `${gTop}<div class="card gold"><h2>Spell the Bible word</h2><p class="bigword" style="letter-spacing:8px">${gs.w.split('').map((c, i) => i < gs.picked.length ? esc(c) : '_').join(' ')}</p></div><div class="card">${gs.bank.filter(b => !gs.picked.includes(b)).map(b => `<span class="chip" data-l="${b.i}" style="font-size:22px;padding:10px 16px">${esc(b.c)}</span>`).join('')}<div id="msg" style="min-height:28px">${done ? '<span class="good">You spelled ' + esc(gs.w) + '! +' + GP(2) + ' ⭐</span>' : ''}</div>${done ? '<button class="btn small" id="again">Next word</button>' : '<button class="btn ghost small" id="undo">Undo</button>'}</div>`;
  $('#gb').onclick = gBack;
  v.querySelectorAll('[data-l]').forEach(c => c.onclick = () => { const b = gs.bank.find(x => x.i === +c.dataset.l); if (b.c === gs.w[gs.picked.length]) { gs.picked.push(b); gameSpell(v); } else $('#msg').innerHTML = '<span class="bad">Try a different letter.' + (missStar(gG, gs.w + gs.picked.length) ? ' −1 ⭐' : '') + '</span>'; });
  const u = $('#undo'); if (u) u.onclick = () => { gs.picked.pop(); gameSpell(v); };
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
    if (S.leader) { if (hubOn() && HUB.me) { try { await hubCall({ action: 'logout' }); } catch (e) {} hubLocalLogout(); } else { S.leader = false; save(); } return render(); }
    if (hubOn()) { sec = 'leaders'; tabOf.leaders = 'post'; render(); return window.scrollTo(0, 0); }
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
async function groupNews(v, g) {
  const t = (SHINE[g] || {}).news;
  const f = hubOn() ? await hubFeed() : null, list = f ? (f.announcements || []).filter(a => a.scope === g) : [];
  v.innerHTML = (t ? `<div class="card red"><p style="margin:0">${esc(t)}</p></div>` : '') + list.map(a => `<div class="card red"><h2>${esc(pickLang(a, 'title') || a.en || a.ne)}</h2>${(LANG === 'ne' && a.bodyNe) || a.bodyEn ? `<p>${esc(LANG === 'ne' && a.bodyNe ? a.bodyNe : a.bodyEn)}</p>` : ''}<p class="muted">${a.created ? esc(fmtDay(a.created.slice(0, 10))) : ''}${a.by ? ' · ' + esc(a.by) : ''}</p>${linkBtn(a.link, 'Open link')}</div>`).join('') || (t ? '' : '<div class="card red"><p style="margin:0">No announcements right now. Check back soon!</p></div>');
}
const shineText = (key, field, dflt) => v => { const t = pickLang(SHINE[key] || {}, field); v.innerHTML = `<div class="card ${field === 'news' ? 'red' : ''}"><p style="margin:0;white-space:pre-wrap">${esc(t || dflt)}</p></div>`; };

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

/* ---------- weekly progress, assignments, teacher view ---------- */
const todayKey = () => dateKey(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStartOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());   // weeks run Sunday to Saturday
const parseKey = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = d => (typeof d === 'string' ? parseKey(d) : d).toLocaleDateString(LANG === 'ne' ? 'ne-NP' : 'en-US', { month: 'short', day: 'numeric' });
const weekLabel = k => { const ws = parseKey(k); return 'Sun ' + fmtDay(ws) + ' – Sat ' + fmtDay(addDays(ws, 6)); };
function logAct(p, k, t, n) { p.log = Array.isArray(p.log) ? p.log : []; p.log.push({ d: todayKey(), k, t: String(t || '').slice(0, 40), n: n || 0 }); if (p.log.length > 1500) p.log = p.log.slice(-1500); }
function hwForWeek(g, wk) { const s = wk, e = dateKey(addDays(parseKey(wk), 6)); return asgList(g).filter(x => x.due && x.due >= s && x.due <= e); }
function weekStats(p, wk) {
  const e = dateKey(addDays(parseKey(wk), 6)), L = (Array.isArray(p.log) ? p.log : []).filter(x => x.d >= wk && x.d <= e), hw = hwForWeek(p.group, wk);
  return { name: p.name, group: p.group, week: wk, stars: Math.max(0, L.reduce((a, x) => a + (x.n || 0), 0)), learned: L.filter(x => x.k === 'learned').length, steps: L.filter(x => x.k === 'step').length, games: L.filter(x => x.k === 'game').length, hwDone: hw.filter(x => (p.hw || {})[x.id]).length, hwTotal: hw.length };
}
const thisWeek = () => dateKey(weekStartOf(new Date()));
function reportText(st) {
  const who = st.group === 'kids' ? 'Kids Shine' : 'Youth Shine';
  return `AGC weekly report: ${st.name} (${who})\nWeek: ${weekLabel(st.week)}\n⭐ ${st.stars} stars · ${st.learned} verse(s) learned · ${st.steps} memory steps · ${st.games} game rounds · ${st.hwDone} of ${st.hwTotal} assignments done\nCode: ${['AGC1', st.name.replace(/\|/g, ''), st.group, st.week, st.stars, st.learned, st.steps, st.games, st.hwDone, st.hwTotal].join('|')}`;
}
function parseReports(text) {
  const out = []; let bad = 0;
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.match(/AGC1\|[^\r\n]*/); if (!m) return;
    const f = m[0].trim().split('|');
    const n = i => Math.max(0, Math.min(9999, parseInt(f[i], 10) || 0));
    if (f.length !== 10 || !/^(kids|youth)$/.test(f[2]) || !/^\d{4}-\d{2}-\d{2}$/.test(f[3]) || !f[1].trim()) { bad++; return; }
    out.push({ name: f[1].trim().slice(0, 20), group: f[2], week: f[3], stars: n(4), learned: n(5), steps: n(6), games: n(7), hwDone: n(8), hwTotal: n(9) });
  });
  return { out, bad };
}
async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; } }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'fail'; }
}
let syncT = null;
function queueSync() { if (!hubOn() || !S || !S.profiles || !S.profiles.some(p => p.sync)) return; clearTimeout(syncT); syncT = setTimeout(syncNow, 4000); }
async function syncNow() {
  for (const p of (S.profiles || [])) {
    if (!p.sync) continue;
    const wk = thisWeek(), st = weekStats(p, wk), sig = [wk, st.stars, st.learned, st.steps, st.games, st.hwDone, st.hwTotal, p.name].join();
    if (p.syncSig === sig) continue;
    try { await hubCall({ action: 'progSend', childId: p.id, deviceId: deviceId(), group: p.group, name: p.name, week: wk, stars: st.stars, learned: st.learned, steps: st.steps, games: st.games, hwDone: st.hwDone, hwTotal: st.hwTotal }); p.syncSig = sig; localSave(); } catch (e) { /* tries again at the next change or next visit */ }
  }
}
function syncCard(list) {
  return `<div class="card"><h2>Share progress with the teacher automatically</h2>
    <p>If you are the parent or guardian, you can let the church teachers see your child's weekly progress without sending a message each week. What is shared: first name, and this week's stars, verses learned, steps, game rounds and assignments done. Nothing else leaves this phone. Only leaders of that group can see it, and you can stop at any time.</p>
    ${list.map(p => `<label class="chk"><input type="checkbox" data-sync="${p.id}" ${p.sync ? 'checked' : ''}> Share ${esc(p.name)}'s progress</label>`).join('')}
    <p class="muted">Turning it off also deletes what was already sent for that child.</p><div id="smsg" aria-live="polite"></div></div>`;
}
function wireSync(v, g) {
  v.querySelectorAll('[data-sync]').forEach(c => c.onchange = async () => {
    const p = S.profiles.find(x => x.id === c.dataset.sync); if (!p) return;
    if (c.checked) {
      if (!confirm('I am ' + p.name + '\'s parent or guardian. I agree to share ' + p.name + '\'s first name and weekly progress with the church teachers. I can stop at any time.')) { c.checked = false; return; }
      p.sync = true; p.syncSig = ''; save(); await syncNow(); $('#smsg', v).innerHTML = '<span class="good">Sharing is on.</span>';
    } else {
      try { await hubCall({ action: 'progForget', childId: p.id, deviceId: deviceId() }); p.sync = false; p.syncSig = ''; save(); $('#smsg', v).innerHTML = '<span class="good">Sharing is off and the shared copy was deleted.</span>'; }
      catch (e) { c.checked = true; $('#smsg', v).innerHTML = `<span class="bad">Could not turn it off right now: ${esc(e.message)} Try again with a connection.</span>`; }
    }
  });
}
function weekCard(list) {
  const wk = thisWeek();
  return `<div class="card gold"><h2>This week</h2><p class="muted">${esc(weekLabel(wk))}. Parents can see progress here. Tap Send to share a short report with the teacher.</p>` + list.map(p => {
    const st = weekStats(p, wk);
    return `<div class="stat"><b>${esc(p.name)}</b><div>⭐ ${st.stars} · 📖 ${st.learned} verse${st.learned === 1 ? '' : 's'} learned · 🪜 ${st.steps} steps · 🎮 ${st.games} rounds · ✅ ${st.hwDone}/${st.hwTotal} assignments</div>
      <button class="btn small" data-rep="${p.id}">Send report to teacher</button></div>`;
  }).join('') + '<div id="repmsg" class="muted" aria-live="polite"></div></div>';
}
function wireWeek(v) {
  v.querySelectorAll('[data-rep]').forEach(b => b.onclick = async () => {
    const p = S.profiles.find(x => x.id === b.dataset.rep); if (!p) return;
    const r = await shareText(reportText(weekStats(p, thisWeek())));
    $('#repmsg', v).textContent = r === 'shared' ? T('Report ready to send.') : r === 'copied' ? T('Report copied. Paste it into a message to the teacher.') : r === 'fail' ? T('Could not copy. Please try again.') : '';
  });
}
const asgList = g => [].concat(((SHINE[g] || {}).assignments) || [], ((HUB.feed && HUB.feed.assignments) || []).filter(a => a.group === g)).filter(a => a && a.id);
function assignView(v, g) {
  if (hubOn() && !v.__f) { v.__f = 1; hubFeed().then(f => { if (f && (f.assignments || []).length && v.isConnected) { assignView(v, g); applyLang(); } }); }
  const p = needProfile(v, g); if (!p) return;
  p.hw = p.hw && typeof p.hw === 'object' ? p.hw : {};
  const today = todayKey(), min = dateKey(addDays(new Date(), -14));
  const list = asgList(g).filter(a => (!a.due || a.due >= min)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  v.innerHTML = profileBar(g) + (list.length ? list.map(a => {
    const done = p.hw[a.id], late = a.due && a.due < today && !done;
    return `<div class="card ${done ? 'done' : ''}"><h2>${esc(pickLang(a, 'title'))}</h2>${pickLang(a, 'detail') ? `<p>${esc(pickLang(a, 'detail'))}</p>` : ''}${a.ref ? `<p>📖 ${esc(a.ref)}</p>` : ''}
      <p class="muted">${a.due ? 'Due ' + esc(fmtDay(a.due)) : 'No due date'}${late ? ' · <span class="bad">Past due</span>' : ''}</p>
      <button class="btn small ${done ? 'ghost' : ''}" data-hw="${esc(a.id)}">${done ? '✓ Done. Tap to undo' : 'Mark done'}</button>${a.due ? calBtns({ title: pickLang(a, 'title'), date: a.due, allDay: true, details: pickLang(a, 'detail') }) : ''}</div>`;
  }).join('') : '<div class="card">No assignments right now. Check back soon!</div>');
  wireBar(g);
  v.querySelectorAll('[data-hw]').forEach(b => b.onclick = () => { const id = b.dataset.hw; if (p.hw[id]) delete p.hw[id]; else p.hw[id] = todayKey(); save(); render(); });
}
let HPROG = {};
function teacherView(v, g) {
  const h = (CFG.leaderPinSha256 || '').toLowerCase();
  if (hubOn() && !S.leader) {
    v.innerHTML = '<div class="card"><h2>Teacher</h2><p>This page is for teachers and leaders. Sign in with your own leader PIN.</p><button class="btn" id="tl">Go to AGC Leaders sign-in</button></div>';
    $('#tl').onclick = () => { sec = 'leaders'; tabOf.leaders = 'post'; render(); window.scrollTo(0, 0); };
    return;
  }
  if (!hubOn() && h && !S.leader) {
    v.innerHTML = '<div class="card"><h2>Teacher</h2><p>This page is for teachers and leaders.</p><button class="btn" id="tl">Leader sign-in</button></div>';
    $('#tl').onclick = async () => { const pin = prompt('Leader PIN'); if (pin == null) return; if ((await sha256(pin)) === h) { S.leader = true; save(); render(); } else alert('That PIN is not right.'); };
    return;
  }
  if (hubOn() && HUB.me && !myArea(g)) { v.innerHTML = `<div class="card"><h2>Teacher</h2><p>Your leader sign-in does not include ${g === 'kids' ? 'Kids Shine' : 'Youth Shine'}. Ask the pastor to add it.</p></div>`; return; }
  S.teacher = S.teacher && typeof S.teacher === 'object' && S.teacher.reports ? S.teacher : { reports: {} };
  const live0 = hubOn() && !!HUB.me;
  const R = S.teacher.reports, hubRows = ((HPROG[g] && live0) ? HPROG[g].rows : []).map(x => Object.assign({ group: g }, x)), hk = new Set(hubRows.map(r => r.name.toLowerCase() + '|' + r.week));
  const all = hubRows.concat(Object.values(R).filter(r => r.group === g && !hk.has(r.name.toLowerCase() + '|' + r.week)));
  const weeks = [...new Set([thisWeek(), ...all.map(r => r.week)])].sort().reverse();
  const sel = weeks.includes(v.__wk) ? v.__wk : weeks[0];
  const rows = all.filter(r => r.week === sel).sort((a, b) => a.name.localeCompare(b.name));
  const posted = asgList(g), live = hubOn() && !!HUB.me;
  if (hubOn() && !v.__f) { v.__f = 1; hubFeed(true).then(f => { if (f && v.isConnected) { teacherView(v, g); applyLang(); } }); }
  if (live && !v.__hl && !(HPROG[g] && Date.now() - HPROG[g].at < 15000)) { v.__hl = 1; hubCall({ action: 'progList', group: g }).then(r => { HPROG[g] = { rows: r.rows || [], at: Date.now() }; v.__hl = 0; if (v.isConnected && sec === g && tabOf[g] === 'teach') { teacherView(v, g); applyLang(); } }).catch(() => { v.__hl = 0; }); }
  v.innerHTML = `<div class="card gold"><h2>Weekly progress</h2>
    <label for="wk">Week</label><select id="wk">${weeks.map(w => `<option value="${w}" ${w === sel ? 'selected' : ''}>${esc(weekLabel(w))}</option>`).join('')}</select>
    ${rows.length ? `<div class="scrollx"><table class="tbl"><tr><th>Name</th><th>⭐</th><th>Verses</th><th>Steps</th><th>Rounds</th><th>Assignments</th>${live ? '<th></th>' : ''}</tr>${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.stars}</td><td>${r.learned}</td><td>${r.steps}</td><td>${r.games}</td><td>${r.hwDone}/${r.hwTotal}</td>${live ? `<td>${r.cid ? `<button class="btn ghost small" data-prm="${esc(r.cid)}">Remove</button>` : ''}</td>` : ''}</tr>`).join('')}</table></div><p class="muted">${rows.length} reported this week.</p>${live ? '<p class="muted">Parents who turn on automatic sending appear here by themselves.</p>' : ''}` : '<p class="muted">No reports for this week yet. Parents send them from My Kids. Paste them below.</p>'}</div>
    ${live ? `<div class="card"><button class="btn ghost small" id="prf">Refresh progress</button></div>
    <div class="card"><h2>This week's verse and lesson</h2><p class="muted">Now: ${esc((SHINE[g] || {}).verse || 'none')}. Post a new one and every phone shows it within about 20 seconds.</p>
    <label for="wv">Verse reference (for example John 3:16)</label><input id="wv" maxlength="60">
    <label for="wve">Verse text in English (optional, NASB 1995)</label><textarea id="wve" rows="2" maxlength="800"></textarea>
    <label for="wvn">Verse text in Nepali (optional, NNRV)</label><textarea id="wvn" rows="2" maxlength="800"></textarea>
    <label for="wle">Lesson in English</label><textarea id="wle" rows="4" maxlength="3000"></textarea>
    <label for="wln">Lesson in Nepali (optional)</label><textarea id="wln" rows="4" maxlength="3000"></textarea>
    <button class="btn" id="wsave">Post verse and lesson</button><div id="wmsg" aria-live="polite"></div></div>` : ''}
    <div class="card"><h2>Add reports</h2><p class="muted">Paste the messages parents send you. You can paste many at once.</p><textarea id="rp" rows="4" aria-label="Paste reports"></textarea>
    <button class="btn" id="radd">Add reports</button> <button class="btn ghost small" id="rclr">Clear all reports</button><div id="rmsg" aria-live="polite"></div></div>
    <div class="card"><h2>Assignments posted</h2>${posted.length ? posted.map(a => `<div class="slot"><div class="t">${esc(a.title)} <span class="muted">${a.due ? esc(fmtDay(a.due)) : ''}</span>${a.group ? ` <button class="btn ghost small" data-adel="${esc(a.id)}">Delete</button>` : ''}</div></div>`).join('') : '<p class="muted">None yet.</p>'}
    <h2 style="margin-top:14px">New assignment</h2><label for="at">Title</label><input id="at" maxlength="80"><label for="ad">Details (optional)</label><textarea id="ad" rows="2" maxlength="300"></textarea>
    <label for="adu">Due date</label><input id="adu" type="date"><button class="btn" id="agen">${live ? 'Post assignment' : 'Make assignment text'}</button><div id="amsg" aria-live="polite"></div>
    ${live ? '<p class="muted">Posts for every phone in about 20 seconds. No files to edit.</p>' : ''}<p class="muted" ${live ? 'hidden' : ''}>Copy the text this makes into <b>data/shine.json</b> under "${g}" then "assignments" (or send it to Claude to add). It shows for everyone after the next update.</p><textarea id="aout" rows="5" readonly aria-label="Assignment text"></textarea></div>`;
  if ($('#prf')) $('#prf').onclick = () => { HPROG[g] = null; teacherView(v, g); applyLang(); };
  v.querySelectorAll('[data-prm]').forEach(b => b.onclick = async () => { if (!confirm('Remove this child\'s progress from the church server?')) return; try { await hubCall({ action: 'progRemove', group: g, cid: b.dataset.prm }); HPROG[g] = null; teacherView(v, g); applyLang(); } catch (e) { alert(e.message); } });
  if ($('#wsave')) $('#wsave').onclick = async () => {
    try { await hubCall({ action: 'weeklySave', group: g, verse: $('#wv').value, verseEn: $('#wve').value, verseNe: $('#wvn').value, lessonEn: $('#wle').value, lessonNe: $('#wln').value }); await hubFeed(true); teacherView(v, g); applyLang(); }
    catch (e) { $('#wmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; }
  };
  $('#wk').onchange = e => { v.__wk = e.target.value; teacherView(v, g); applyLang(); };
  $('#radd').onclick = () => {
    const { out, bad } = parseReports($('#rp').value);
    out.forEach(r => { R[r.group + '|' + r.name.toLowerCase() + '|' + r.week] = r; });
    save();
    if (out.length) { v.__wk = out.filter(r => r.group === g).map(r => r.week).sort().pop() || v.__wk; teacherView(v, g); applyLang(); }
    $('#rmsg').innerHTML = `<span class="${out.length ? 'good' : 'bad'}">${out.length ? 'Added ' + out.length + (out.length === 1 ? ' report.' : ' reports.') : 'No reports found. Paste the whole message including the Code line.'}${bad ? ' ' + bad + ' could not be read.' : ''}</span>`;
  };
  $('#rclr').onclick = () => { if (confirm('Clear all saved reports from this phone?')) { S.teacher.reports = {}; save(); teacherView(v, g); applyLang(); } };
  v.querySelectorAll('[data-adel]').forEach(b => b.onclick = async () => { if (!confirm('Delete this assignment?')) return; try { await hubCall({ action: 'asgDelete', id: b.dataset.adel }); await hubFeed(true); teacherView(v, g); applyLang(); } catch (e) { alert(e.message); } });
  $('#agen').onclick = async () => {
    const title = $('#at').value.trim(), due = $('#adu').value;
    if (live) {
      if (!title) { $('#amsg').innerHTML = '<span class="bad">Please type a title first.</span>'; return; }
      try { await hubCall({ action: 'asgSave', group: g, title, detail: $('#ad').value.trim(), due }); await hubFeed(true); teacherView(v, g); applyLang(); }
      catch (e) { $('#amsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; }
      return;
    }
    if (!title) { $('#aout').value = 'Please type a title first.'; return; }
    const o = { id: 'a-' + (due || todayKey()).replace(/-/g, '') + '-' + uid().slice(0, 3), title: title.slice(0, 80), detail: $('#ad').value.trim().slice(0, 300), due: due || '' };
    $('#aout').value = JSON.stringify(o, null, 2) + ',';
  };
}

/* ---------- AGC Hub: Worship + Leaders (data lives in your Google Drive through your own Apps Script) ---------- */
const HUBKEY = 'agc.hub.v1', SEENKEY = 'agc.seen', FEEDKEY = 'agc.hub.feed';
let HUB = { feed: null, at: 0, me: null, offline: false };
let WORSHIP = { announcements: [], songs: [], events: [] };
try { const m = JSON.parse(localStorage.getItem(HUBKEY) || 'null'); if (m && m.token && m.exp > Date.now()) HUB.me = m; } catch (e) {}
const hubOn = () => !!(CFG.hubUrl && /^https:\/\//.test(CFG.hubUrl));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
function deviceId() { let d = lsGet('agc.dev', ''); if (!d) { d = 'd' + uid() + uid() + uid(); lsSet('agc.dev', d); } return d; }
function hubLocalLogout() { HPROG = {}; HUB.me = null; try { localStorage.removeItem(HUBKEY); } catch (e) {} S.leader = false; save(); }
async function hubCall(body) {
  if (!hubOn()) throw new Error('The shared server is not connected yet.');
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(CFG.hubUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: HUB.me && HUB.me.token }, body)), signal: ctl.signal });
    const j = await r.json();
    if (j.error) { if (/sign in again/i.test(j.error)) hubLocalLogout(); throw new Error(j.error); }
    HUB.at = 0; return j;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('The server took too long. Please try again.');
    if (e instanceof TypeError) throw new Error('No connection. Please check your internet and try again.');
    throw e;
  } finally { clearTimeout(to); }
}
/* The weekly verse and lesson that teachers post in the app replace the file defaults. */
function applyWeekly(f) {
  if (!f || !f.weekly) return;
  ['kids', 'youth'].forEach(g => {
    const w = f.weekly[g]; if (!w) return;
    const o = SHINE[g] = SHINE[g] || {};
    if (w.verse) o.verse = w.verse;
    if (w.lessonEn) o.lesson = w.lessonEn;
    if (w.lessonNe) o.lesson_ne = w.lessonNe;
    const dv = CFG.defaultVersion || {}; o.verseText = Object.assign({}, o.verseText);
    if (w.verseEn && dv.en) o.verseText[dv.en] = w.verseEn;
    if (w.verseNe && dv.ne) o.verseText[dv.ne] = w.verseNe;
  });
}
async function hubFeed(force) {
  if (!hubOn()) return null;
  if (!force && HUB.feed && Date.now() - HUB.at < 20000) return HUB.feed;
  try {
    const r = await fetch(CFG.hubUrl + '?action=hub'), j = await r.json();
    if (!j || j.error || !Array.isArray(j.songs)) throw new Error('bad feed');
    HUB.feed = j; HUB.at = Date.now(); HUB.offline = false; lsSet(FEEDKEY, JSON.stringify(j)); applyWeekly(j);
  } catch (e) {
    HUB.offline = true;
    if (!HUB.feed) { try { HUB.feed = JSON.parse(lsGet(FEEDKEY, 'null')); applyWeekly(HUB.feed); } catch (x) {} }
  }
  return HUB.feed;
}
const wData = async force => { const f = await hubFeed(force); return f || WORSHIP; };
const hubNote = () => hubOn() ? '' : '<div class="preview">The shared Drive server is not connected yet, so this page shows only what the pastor has put in the app files. See hub/SETUP.md.</div>';
const offNote = () => HUB.offline ? '<div class="preview">You are offline. Showing what was saved last time.</div>' : '';
const fmtLong = d => parseKey(d).toLocaleDateString(LANG === 'ne' ? 'ne-NP' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = t => { if (!/^\d\d:\d\d$/.test(t || '')) return ''; const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(LANG === 'ne' ? 'ne-NP' : 'en-US', { hour: 'numeric', minute: '2-digit' }); };
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const linkBtn = (u, label, cls) => safeUrl(u) ? `<a class="btn small ${cls || ''}" href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${label}</a>` : '';

/* what's new dot on the Worship tab */
function newCount(f) { if (!f) return 0; const seen = lsGet(SEENKEY, ''); return (f.announcements || []).filter(x => (!x.scope || x.scope === 'all' || x.scope === 'worship') && (x.created || '') > seen).length + (f.events || []).filter(x => (x.created || '') > seen).length; }
function markSeen() { lsSet(SEENKEY, new Date().toISOString()); const b = $('#tabs [data-s="worship"]'); if (b) b.classList.remove('has-new'); }
async function refreshBadge() { const f = await hubFeed(); const b = $('#tabs [data-s="worship"]'); if (b) b.classList.toggle('has-new', newCount(f) > 0 && !(sec === 'worship' && tabOf.worship === 'news')); }

/* add to calendar (works offline, no account needed) */
const CAL = {};
function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = (time || '00:00').split(':').map(Number), guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = t => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t)); const g = k => +p.find(x => x.type === k).value; return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - t; };
  let t = guess - off(guess); t = guess - off(t); return new Date(t);
}
const icsStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const icsDay = k => k.replace(/-/g, '');
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
function calTimes(ev) {
  if (ev.allDay || !ev.time) return { allDay: true, s: icsDay(ev.date), e: icsDay(dateKey(addDays(parseKey(ev.date), 1))) };
  const s = zonedToUtc(ev.date, ev.time, 'America/Chicago'), e = new Date(s.getTime() + (ev.minutes || 60) * 60000);
  return { allDay: false, s: icsStamp(s), e: icsStamp(e) };
}
function makeIcs(ev) {
  const t = calTimes(ev);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AGC Connect//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + uid() + uid() + '@agc-connect', 'DTSTAMP:' + icsStamp(new Date()),
    t.allDay ? 'DTSTART;VALUE=DATE:' + t.s : 'DTSTART:' + t.s, t.allDay ? 'DTEND;VALUE=DATE:' + t.e : 'DTEND:' + t.e,
    'SUMMARY:' + icsEsc(ev.title), ev.place ? 'LOCATION:' + icsEsc(ev.place) : '', ev.details ? 'DESCRIPTION:' + icsEsc(ev.details) : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title), t.allDay ? 'TRIGGER:-PT12H' : 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n') + '\r\n';
}
function gcalUrl(ev) {
  const t = calTimes(ev);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + t.s + '/' + t.e + '&details=' + encodeURIComponent(ev.details || '') + '&location=' + encodeURIComponent(ev.place || '') + (t.allDay ? '' : '&ctz=America/Chicago');
}
function downloadIcs(ev) {
  const blob = new Blob([makeIcs(ev)], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = (ev.title || 'event').replace(/[^\w]+/g, '-').slice(0, 40) + '.ics';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function calBtns(ev) {
  const k = uid(); CAL[k] = ev;
  return `<div class="row"><button class="btn small ghost" data-cal="${k}" data-k="ics">📅 Add to calendar</button><button class="btn small ghost" data-cal="${k}" data-k="g">Google Calendar</button></div>`;
}

/* ---------- Worship ---------- */
async function worshipSongs(v) {
  v.innerHTML = '<div class="card">Loading…</div>';
  const d = await wData(), songs = d.songs || [];
  v.innerHTML = `${hubNote()}${offNote()}<div class="card gold"><h2>Nepali Christian songs</h2><p class="muted">Search the church list, or search YouTube. Song words and chords stay with their owners; each song here opens its own link.</p>
    <input id="sq" placeholder="Song name or type (Nepali or English)" aria-label="Search songs" autocomplete="off">
    <a class="btn small" id="syt" target="_blank" rel="noopener" href="#">🔎 Search YouTube</a></div><div id="slist"></div>
    ${(WORSHIP.sites || []).length ? `<div class="card"><h2>More Nepali songs online</h2><p class="muted">Free song websites. They open in a new tab and belong to their owners.</p>${WORSHIP.sites.map(x => `<div class="slot"><div class="t">${esc(x.name)}<div class="muted">${esc(x.note || '')}</div></div>${linkBtn(x.url, 'Open')}</div>`).join('')}</div>` : ''}`;
  const ytUrl = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent((q || '') + ' Nepali Christian song');
  const draw = () => {
    const q = $('#sq').value.trim().toLowerCase();
    $('#syt').href = ytUrl($('#sq').value.trim());
    const list = songs.filter(s => !q || [s.ne, s.en, s.cat, s.key].join(' ').toLowerCase().includes(q));
    $('#slist').innerHTML = list.length ? list.map(s => `<div class="card song"><b lang="ne" data-keep>${esc(s.ne || s.en)}</b>${s.ne && s.en ? ` <span class="muted">${esc(s.en)}</span>` : ''}
      <div>${s.cat ? `<span class="pill">${esc(s.cat)}</span> ` : ''}${s.key ? `<span class="muted">Key ${esc(s.key)}</span>` : ''}</div>
      <div class="row">${linkBtn(s.link, '🎼 Words / chords')}${linkBtn(s.audio, '▶ Listen', 'ghost')}</div></div>`).join('')
      : `<div class="card">${songs.length ? 'No song matches that. Try the YouTube search above.' : 'No songs have been added yet. Worship leaders add songs in the AGC Leaders tab. You can still search YouTube above.'}</div>`;
  };
  $('#sq').oninput = draw; draw();
}
async function worshipNews(v) {
  v.innerHTML = '<div class="card">Loading…</div>';
  const d = await wData(), list = (d.announcements || []).filter(a => !a.scope || a.scope === 'all' || a.scope === 'worship');
  v.innerHTML = `${hubNote()}${offNote()}` + (list.length ? list.map(a => `<div class="card ${a.pinned ? 'gold' : ''}"><h2>${a.pinned ? '📌 ' : ''}${esc(pickLang(a, 'title') || a.en || a.ne)}</h2>${(LANG === 'ne' && a.bodyNe) || a.bodyEn || a.bodyNe ? `<p>${esc(LANG === 'ne' && a.bodyNe ? a.bodyNe : (a.bodyEn || a.bodyNe))}</p>` : ''}
    <p class="muted">${a.created ? esc(fmtDay(a.created.slice(0, 10))) : ''}${a.by ? ' · ' + esc(a.by) : ''}</p>${linkBtn(a.link, 'Open link')}</div>`).join('') : '<div class="card">No announcements right now. Check back soon!</div>');
  markSeen();
}
async function worshipCal(v) {
  v.innerHTML = '<div class="card">Loading…</div>';
  const d = await wData(), list = d.events || [];
  v.innerHTML = `${hubNote()}${offNote()}<p class="muted">Times are Central Time (Sioux Falls). Your calendar shows them in your own time.</p>` + (list.length ? list.map(e => {
    const title = (LANG === 'ne' && e.ne ? e.ne : (e.en || e.ne));
    return `<div class="card"><h2>${esc(title)}</h2><p><b>${esc(fmtLong(e.date))}</b> ${esc(fmtTime(e.time))}</p>${e.place ? `<p>📍 ${esc(e.place)}</p>` : ''}${e.notes ? `<p class="muted">${esc(e.notes)}</p>` : ''}
      ${linkBtn(e.link, 'Open link', 'ghost')}${calBtns({ title, date: e.date, time: e.time, minutes: e.minutes, place: e.place, details: e.notes || '' })}</div>`;
  }).join('') : '<div class="card">No upcoming events yet.</div>');
  markSeen();
}
async function worshipFellow(v) {
  v.innerHTML = '<div class="card">Loading…</div>';
  const d = await wData(), list = d.board || [];
  if (!hubOn()) { v.innerHTML = hubNote() + '<div class="card"><h2>Fellowship</h2><p>This is where church family shares praises, encouragement and prayer needs with each other. It turns on when the shared Drive server is connected.</p></div>'; return; }
  v.innerHTML = `${offNote()}<div class="card gold"><h2>Fellowship</h2><p class="muted">Encourage one another. First names only. Links are removed. Be kind. Leaders can remove posts. This board is for adults and families. Children use their own groups.</p>
    <label for="fn">Your first name</label><input id="fn" maxlength="20" autocomplete="given-name" value="${esc(lsGet('agc.name', ''))}">
    <label for="ft">Message</label><textarea id="ft" maxlength="280" rows="3" placeholder="Share a praise or an encouragement…"></textarea>
    <button class="btn" id="fgo">Post</button> <button class="btn ghost small" id="fref">Refresh</button><div id="fmsg" aria-live="polite"></div></div>
    <div id="fl">${list.length ? list.map(p => `<div class="card"><b>${esc(p.name)}</b> <span class="muted">${esc(fmtDay((p.created || '').slice(0, 10) || todayKey()))}</span><p>${esc(p.text)}</p>
      <button class="btn small ghost" data-rep="${esc(p.id)}">Report</button>${HUB.me ? ` <button class="btn small ghost" data-del="${esc(p.id)}">Remove (leader)</button>` : ''}</div>`).join('') : '<div class="card">No posts yet. Be the first to encourage someone.</div>'}</div>`;
  $('#fref').onclick = async () => { await hubFeed(true); worshipFellow(v); applyLang(); };
  $('#fgo').onclick = async () => {
    const name = $('#fn').value.trim(), text = $('#ft').value.trim();
    if (!name || !text) { $('#fmsg').innerHTML = '<span class="bad">Please type your first name and a message.</span>'; return; }
    $('#fgo').disabled = true;
    try { await hubCall({ action: 'post', name, text, deviceId: deviceId() }); lsSet('agc.name', name.split(/\s+/)[0]); await hubFeed(true); worshipFellow(v); applyLang(); }
    catch (e) { $('#fmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; $('#fgo').disabled = false; }
  };
  v.querySelectorAll('[data-rep]').forEach(b => b.onclick = async () => { if (!confirm('Report this post to a leader?')) return; try { await hubCall({ action: 'report', id: b.dataset.rep }); await hubFeed(true); worshipFellow(v); applyLang(); } catch (e) { alert(e.message); } });
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Remove this post?')) return; try { await hubCall({ action: 'boardSet', id: b.dataset.del, status: 'delete' }); await hubFeed(true); worshipFellow(v); applyLang(); } catch (e) { alert(e.message); } });
}

/* ---------- AGC Leaders ---------- */
const fld = (id, label, extra) => `<label for="${id}">${label}</label><input id="${id}" ${extra || ''}>`;
async function leaderGate(v, then) {
  if (!hubOn()) { v.innerHTML = hubNote() + '<div class="card"><h2>AGC Leaders</h2><p>Leaders share announcements, songs, events and ministry resources here. Each leader has a personal PIN. It turns on when the shared Drive server is connected.</p></div>'; return; }
  if (HUB.me && HUB.me.exp > Date.now()) return then();
  v.innerHTML = '<div class="card">Loading…</div>';
  const f = await hubFeed(true), people = (f && f.leaders) || [];
  v.innerHTML = `${offNote()}<div class="card gold"><h2>AGC Leaders sign-in</h2><p class="muted">Each leader has their own PIN, given by the pastor. Keep it private.</p>
    <label for="ln">Your name</label><select id="ln">${people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.role ? ' (' + esc(p.role) + ')' : ''}</option>`).join('')}</select>
    <label for="lp">PIN</label><input id="lp" type="password" inputmode="numeric" autocomplete="off">
    <button class="btn" id="lgo">Sign in</button><div id="lmsg" aria-live="polite"></div></div>`;
  const go = async () => {
    $('#lgo').disabled = true;
    try {
      const r = await hubCall({ action: 'login', leader: $('#ln').value, pin: $('#lp').value });
      HUB.me = { token: r.token, name: r.name, role: r.role, admin: !!r.admin, areas: r.areas || [], exp: Date.now() + 21000 * 1000 }; lsSet(HUBKEY, JSON.stringify(HUB.me)); S.leader = true; save(); render();
    } catch (e) { $('#lmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; $('#lgo').disabled = false; }
  };
  $('#lgo').onclick = go; $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); };
}
const AREA_NAME = { kids: 'Kids', youth: 'Youth', worship: 'Worship' };
const areaList = m => m.admin ? 'All areas' : ((m.areas || []).map(a => AREA_NAME[a]).join(', ') || 'No area yet');
const myArea = a => !!(HUB.me && (HUB.me.admin || (HUB.me.areas || []).includes(a)));
const meBar = () => `<div class="pbar"><b>${esc(HUB.me.name)}</b><span class="muted">${HUB.me.role && HUB.me.role !== HUB.me.name ? esc(HUB.me.role) + ' · ' : ''}${esc(areaList(HUB.me))}</span><button class="btn small ghost" id="lout">Sign out</button></div>`;
function wireOut() { const b = $('#lout'); if (b) b.onclick = async () => { try { await hubCall({ action: 'logout' }); } catch (e) {} hubLocalLogout(); render(); }; }
async function leaderLoad(v) { try { return await hubCall({ action: 'leaderData' }); } catch (e) { v.innerHTML = `<div class="card"><span class="bad">${esc(e.message)}</span></div>`; return null; } }
const act = (v, body, again) => async () => { try { await hubCall(body); await hubFeed(true); await again(); } catch (e) { alert(e.message); } };

function leadersPost(v) {
  leaderGate(v, async () => {
    v.innerHTML = '<div class="card">Loading…</div>';
    const d = await leaderLoad(v); if (!d) return; const f = (await hubFeed(true)) || {};
    v.innerHTML = `${meBar()}
    <details class="card" open><summary><b>New announcement</b></summary>
      <label for="as">Who sees it</label><select id="as">${HUB.me.admin ? '<option value="all">Everyone</option>' : ''}${['worship', 'kids', 'youth'].filter(myArea).map(a => `<option value="${a}">${AREA_NAME[a]} group</option>`).join('')}<option value="leaders">Leaders only</option></select>
      ${fld('at', 'Title (English)', 'maxlength="120"')}${fld('atn', 'Title (Nepali, optional)', 'maxlength="120" lang="ne"')}
      <label for="ab">Message (English)</label><textarea id="ab" rows="3" maxlength="1000"></textarea><label for="abn">Message (Nepali, optional)</label><textarea id="abn" rows="3" maxlength="1000" lang="ne"></textarea>
      ${fld('al', 'Link (optional)', 'type="url" placeholder="https://"')}<label class="chk"><input type="checkbox" id="ap"> Pin to the top</label><button class="btn" id="asave">Post announcement</button><div id="amsg"></div></details>
    <details class="card"><summary><b>New event (adds to calendars)</b></summary>
      <label for="ea">Who it is for</label><select id="ea">${HUB.me.admin ? '<option value="all">Everyone</option>' : ''}${['worship', 'kids', 'youth'].filter(myArea).map(a => `<option value="${a}">${AREA_NAME[a]}</option>`).join('')}</select>
      ${fld('ed', 'Date', 'type="date"')}${fld('et', 'Start time (Central)', 'type="time"')}${fld('em', 'Length in minutes', 'type="number" value="60" min="5" max="1440"')}
      ${fld('et1', 'Title (English)', 'maxlength="120"')}${fld('et2', 'Title (Nepali, optional)', 'maxlength="120" lang="ne"')}${fld('ep', 'Place', 'maxlength="120"')}${fld('el', 'Link (optional)', 'type="url" placeholder="https://"')}${fld('en', 'Notes', 'maxlength="500"')}
      <button class="btn" id="esave">Save event</button><div id="emsg"></div></details>
    ${myArea('worship') ? `<details class="card"><summary><b>New song</b></summary>
      <p class="muted">Add the song name and a link to its words or chords (a website, YouTube, or a Drive file). Do not paste copyrighted lyrics here.</p>
      ${fld('sn', 'Song name (Nepali)', 'maxlength="120" lang="ne"')}${fld('se', 'Song name (romanized or English, optional)', 'maxlength="120"')}${fld('sc', 'Type (Worship, Praise, Hymn…)', 'maxlength="40"')}${fld('sk', 'Key (optional)', 'maxlength="10"')}${fld('sl', 'Link to words / chords', 'type="url" placeholder="https://"')}${fld('sa', 'Link to listen (optional)', 'type="url" placeholder="https://"')}
      <button class="btn" id="ssave">Save song</button><div id="smsg"></div></details>` : ''}
    <div class="card"><h2>Posted announcements</h2>${d.announcements.length ? d.announcements.map(a => `<div class="slot"><div class="t">${esc(a.en || a.ne)} <span class="muted">${a.scope === 'leaders' ? 'Leaders only' : a.scope === 'all' ? 'Everyone' : AREA_NAME[a.scope] || a.scope}</span></div>${a.canEdit ? `<button class="btn small ghost" data-ad="${esc(a.id)}">Delete</button>` : ''}</div>`).join('') : '<p class="muted">None yet.</p>'}</div>
    <div class="card"><h2>Events</h2>${(f.events || []).length ? f.events.map(e => `<div class="slot"><div class="t">${esc(e.en || e.ne)} <span class="muted">${esc(e.date)}</span></div>${(HUB.me.admin || e.area === 'all' ? HUB.me.admin : myArea(e.area)) ? `<button class="btn small ghost" data-ed="${esc(e.id)}">Delete</button>` : ''}</div>`).join('') : '<p class="muted">None yet.</p>'}</div>
    <div class="card"><h2>Songs</h2>${(f.songs || []).length ? f.songs.map(s => `<div class="slot"><div class="t">${esc(s.ne || s.en)}</div>${myArea('worship') ? `<button class="btn small ghost" data-sd="${esc(s.id)}">Delete</button>` : ''}</div>`).join('') : '<p class="muted">None yet.</p>'}</div>
    <div class="card"><h2>Fellowship posts waiting for review</h2>${d.flagged.length ? d.flagged.map(p => `<div class="card"><b>${esc(p.name)}</b> <span class="muted">${esc(p.status)}</span><p>${esc(p.text)}</p><button class="btn small" data-bk="${esc(p.id)}">Put back</button> <button class="btn small ghost" data-bd="${esc(p.id)}">Delete</button></div>`).join('') : '<p class="muted">Nothing reported.</p>'}</div>`;
    wireOut();
    const reload = () => render();
    const send = (body, msgEl, ok) => async () => { try { await hubCall(body()); await hubFeed(true); msgEl && (msgEl.innerHTML = `<span class="good">${ok}</span>`); setTimeout(reload, 600); } catch (e) { if (msgEl) msgEl.innerHTML = `<span class="bad">${esc(e.message)}</span>`; else alert(e.message); } };
    $('#asave').onclick = send(() => ({ action: 'annSave', scope: $('#as').value, titleEn: $('#at').value, titleNe: $('#atn').value, bodyEn: $('#ab').value, bodyNe: $('#abn').value, link: $('#al').value, pinned: $('#ap').checked }), $('#amsg'), 'Posted.');
    $('#esave').onclick = send(() => ({ action: 'eventSave', date: $('#ed').value, time: $('#et').value, minutes: $('#em').value, titleEn: $('#et1').value, titleNe: $('#et2').value, area: $('#ea').value, place: $('#ep').value, link: $('#el').value, notes: $('#en').value }), $('#emsg'), 'Saved.');
    if ($('#ssave')) $('#ssave').onclick = send(() => ({ action: 'songSave', titleNe: $('#sn').value, titleEn: $('#se').value, category: $('#sc').value, songKey: $('#sk').value, link: $('#sl').value, audio: $('#sa').value }), $('#smsg'), 'Saved.');
    const del = (attr, action, extra) => v.querySelectorAll('[' + attr + ']').forEach(b => b.onclick = async () => { if (!confirm('Delete this?')) return; try { await hubCall(Object.assign({ action, id: b.getAttribute(attr) }, extra || {})); await hubFeed(true); render(); } catch (e) { alert(e.message); } });
    del('data-ad', 'annDelete'); del('data-ed', 'eventDelete'); del('data-sd', 'songDelete'); del('data-bd', 'boardSet', { status: 'delete' }); del('data-bk', 'boardSet', { status: 'ok' });
    applyLang();
  });
}
function leadersRes(v) {
  leaderGate(v, async () => {
    v.innerHTML = '<div class="card">Loading…</div>';
    const d = await leaderLoad(v); if (!d) return; const adm = HUB.me.admin, tools = (await getJson('data/bible-tools.json')) || [];
    v.innerHTML = `${meBar()}<div class="card gold"><h2>Ministry resources</h2>${adm
      ? '<p class="muted">Only you can add resources. Put documents in your Drive folder <b>Executive Assistant Workspace › AGC Connect › Leader Resources</b>, inside <b>All Leaders</b>, <b>Kids</b>, <b>Youth</b> or <b>Worship</b>. Leaders see only their own groups and All Leaders. Share the folder with leaders as <b>Viewer</b>, and turn off download, print and copy on each file.</p>'
      : '<p class="muted">Read-only. These are the resources shared with your group. Ask the pastor if you need something added.</p>'}</div>
    ${tools.length ? `<div class="card"><h2>Bible study and preaching tools</h2><p class="muted">Free websites that open in your browser. Some sites also offer paid extras.</p>${tools.map(gp => `<h3 style="margin:12px 0 4px">${esc(gp.group)}</h3>${(gp.items || []).map(it => `<div class="slot"><div class="t">${esc(it.title)}<div class="muted">${esc(it.desc || '')}</div></div>${linkBtn(it.url, 'Open')}</div>`).join('')}`).join('')}</div>` : ''}
    <div class="card"><h2>Files</h2>${d.files.length ? d.files.map(f => `<div class="slot"><div class="t">${esc(f.name)}<div class="muted">${esc(f.cat || 'All Leaders')} · ${esc(f.type)}</div></div>${linkBtn(f.url, 'View')}</div>`).join('') : '<p class="muted">No files yet.</p>'}</div>
    <div class="card"><h2>Links</h2>${d.resources.length ? d.resources.map(r => `<div class="slot"><div class="t">${esc(r.title)}<div class="muted">${esc(r.cat || 'All Leaders')} ${esc(r.desc || '')}</div></div>${linkBtn(r.url, 'View')}${adm ? `<button class="btn small ghost" data-rd="${esc(r.id)}">✕</button>` : ''}</div>`).join('') : '<p class="muted">None yet.</p>'}
      ${adm ? `<h2 style="margin-top:14px">Add a link</h2>${fld('rt', 'Title', 'maxlength="120"')}<label for="rc">Who can see it</label><select id="rc"><option value="">All Leaders</option><option>Kids</option><option>Youth</option><option>Worship</option></select>${fld('rds', 'Short note', 'maxlength="300"')}${fld('ru', 'Link', 'type="url" placeholder="https://"')}<button class="btn" id="rsave">Save link</button><div id="rmsg"></div>` : ''}</div>`;
    wireOut();
    if (adm) {
      $('#rsave').onclick = async () => { try { await hubCall({ action: 'resSave', title: $('#rt').value, category: $('#rc').value, desc: $('#rds').value, url: $('#ru').value }); render(); } catch (e) { $('#rmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; } };
      v.querySelectorAll('[data-rd]').forEach(b => b.onclick = async () => { if (!confirm('Remove this link?')) return; try { await hubCall({ action: 'resDelete', id: b.dataset.rd }); render(); } catch (e) { alert(e.message); } });
    }
    applyLang();
  });
}
function leadersBoard(v) {
  leaderGate(v, async () => {
    v.innerHTML = '<div class="card">Loading…</div>';
    const d = await leaderLoad(v); if (!d) return;
    v.innerHTML = `${meBar()}<div class="card gold"><h2>Leader Board</h2><p class="muted">Private to signed-in leaders. Share updates, needs and plans.</p><label for="la">Who sees it</label><select id="la"><option value="leaders">All leaders</option>${['kids', 'youth', 'worship'].filter(myArea).map(a => `<option value="${a}">${AREA_NAME[a]} leaders</option>`).join('')}</select><textarea id="lt" rows="3" maxlength="1000" aria-label="Message to leaders"></textarea><button class="btn" id="lpost">Post</button><div id="lmsg"></div></div>
    ${d.lboard.length ? d.lboard.map(m => `<div class="card"><b>${esc(m.by)}</b> <span class="muted">${esc(fmtDay((m.created || '').slice(0, 10) || todayKey()))}${m.area && m.area !== 'leaders' ? ' · ' + esc(AREA_NAME[m.area]) + ' leaders' : ''}</span><p>${esc(m.text)}</p>${m.by === HUB.me.name || HUB.me.admin ? `<button class="btn small ghost" data-md="${esc(m.id)}">Delete</button>` : ''}</div>`).join('') : '<div class="card">No messages yet.</div>'}`;
    wireOut();
    $('#lpost').onclick = async () => { try { await hubCall({ action: 'lboardPost', area: $('#la').value, text: $('#lt').value }); render(); } catch (e) { $('#lmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; } };
    v.querySelectorAll('[data-md]').forEach(b => b.onclick = async () => { if (!confirm('Delete this message?')) return; try { await hubCall({ action: 'lboardDelete', id: b.dataset.md }); render(); } catch (e) { alert(e.message); } });
    applyLang();
  });
}
/* ---------- Leader Growth: for every leader (elders, deacons, helpers, team leads), whatever their area ---------- */
const bgLink = ref => 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(ref) + '&version=NASB1995';
function leadersGrowth(v) {
  leaderGate(v, async () => {
    v.innerHTML = '<div class="card">Loading…</div>';
    const G = (await getJson('data/leader-growth.json')) || { focus: [], links: [] }, d = await leaderLoad(v); if (!d) return;
    const wk = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 6048e5), f = G.focus.length ? G.focus[wk % G.focus.length] : null;
    const notes = (d.announcements || []).filter(a => a.scope === 'leaders').slice(0, 3);
    v.innerHTML = `${meBar()}
    <div class="card gold"><h2>🌱 Leadership growth</h2><p>For every leader at AGC: elders, deacons, team leads, helpers and ministry partners. Take a few quiet minutes each week to grow in the Word, in prayer and in serving.</p></div>
    ${f ? `<div class="card"><h2>This week’s focus: ${esc(f.title)}</h2><p><b>Read:</b> <a href="${esc(bgLink(f.ref))}" target="_blank" rel="noopener">${esc(f.ref)}</a> <span class="muted">(opens the passage in NASB 1995)</span></p><p><b>Think about it:</b> ${esc(f.ask)}</p><p><b>Try this week:</b> ${esc(f.act)}</p></div>` : ''}
    ${notes.length ? `<div class="card"><h2>From the pastor</h2>${notes.map(a => `<div class="slot"><div class="t">${esc(a.en || a.ne)}<div class="muted">${esc(a.bodyEn || a.body || '')}</div></div></div>`).join('')}</div>` : ''}
    ${G.links.map(gp => `<div class="card"><h2>${esc(gp.group)}</h2>${(gp.items || []).map(it => `<div class="slot"><div class="t">${esc(it.title)}<div class="muted">${esc(it.desc || '')}</div></div>${linkBtn(it.url, 'Open')}</div>`).join('')}</div>`).join('')}
    <div class="card"><h2>More for you</h2><p class="muted">Files and links from the pastor are under <b>Resources</b>. Share an idea or a prayer need with the other leaders on the <b>Leader Board</b>.</p><div class="seg"><button class="btn small ghost" id="gres">Resources</button><button class="btn small ghost" id="glb">Leader Board</button></div></div>`;
    wireOut(); $('#gres').onclick = () => { tabOf.leaders = 'res'; render(); }; $('#glb').onclick = () => { tabOf.leaders = 'lboard'; render(); }; applyLang();
  });
}
function leadersTeam(v) {
  leaderGate(v, async () => {
    if (!HUB.me.admin) { v.innerHTML = meBar() + '<div class="card"><h2>Team</h2><p>Only the pastor (admin) can add leaders and give out PINs.</p></div>'; wireOut(); return; }
    v.innerHTML = '<div class="card">Loading…</div>';
    const d = await leaderLoad(v); if (!d) return;
    const pinHtml = v.__pin ? `<div class="card red"><h2>PIN for ${esc(v.__pin.name)}</h2><div class="bigpin" data-keep>${esc(v.__pin.pin)}</div><p>This is shown only once. Write it down now.</p></div>` : '';
    v.innerHTML = `${meBar()}${pinHtml}<div class="card gold"><h2>Add a leader</h2><p class="muted">Each leader gets their own 6-digit PIN. It is shown once. Write it down and give it to them in person or by a private message.</p>${fld('tn', 'First name', 'maxlength="20"')}${fld('tr', 'Role (pick a suggestion or type your own)', 'maxlength="40" list="troles" placeholder="Ministry Leader"')}<datalist id="troles">${['Ministry Leader', 'Elder', 'Deacon', 'Team Lead', 'Hospitality Team', 'Outreach Team', 'Prayer Team', 'Media Team', 'Sunday School Teacher', 'Youth Leader', 'Worship Leader'].map(r => `<option value="${r}">`).join('')}</datalist><p class="muted">Not in Kids, Youth or Worship? Choose <b>Ministry Leader</b> and leave every box below empty. They sign in with their own PIN and see the Growth tab, All Leaders files, the Leader Board and leaders-only announcements.</p><p class="muted">Give access to:</p><div class="row">${['kids', 'youth', 'worship'].map(a => `<label class="chk"><input type="checkbox" class="tar" value="${a}"> ${AREA_NAME[a]}</label>`).join('')}</div><button class="btn" id="tadd">Add leader</button><div id="tmsg"></div></div>
    <div class="card"><h2>Leaders</h2>${d.team.length ? d.team.map(t => `<div class="slot"><div class="t">${esc(t.name)} <span class="muted">${esc(t.role)}${t.active ? '' : ' · removed'}</span>${t.active ? `<div class="row">${['kids', 'youth', 'worship'].map(a => `<label class="chk"><input type="checkbox" data-ta="${esc(t.id)}" value="${a}" ${t.areas.includes(a) ? 'checked' : ''}> ${AREA_NAME[a]}</label>`).join('')}</div>` : ''}</div>${t.active ? `<button class="btn small ghost" data-tr="${esc(t.id)}">New PIN</button><button class="btn small ghost" data-tx="${esc(t.id)}">Remove</button>` : ''}</div>`).join('') : '<p class="muted">No leaders yet. You are signed in as admin.</p>'}</div>`;
    wireOut();
    const showPin = (name, pin) => { v.__pin = { name, pin }; leadersTeam(v); window.scrollTo(0, 0); };
    $('#tadd').onclick = async () => { try { const r = await hubCall({ action: 'leaderAdd', name: $('#tn').value, role: $('#tr').value, areas: [...v.querySelectorAll('.tar:checked')].map(x => x.value) }); await hubFeed(true); showPin(r.name, r.pin); } catch (e) { $('#tmsg').innerHTML = `<span class="bad">${esc(e.message)}</span>`; } };
    v.querySelectorAll('[data-ta]').forEach(c => c.onchange = async () => { const id = c.dataset.ta; try { await hubCall({ action: 'leaderAreas', id, areas: [...v.querySelectorAll('[data-ta="' + id + '"]:checked')].map(x => x.value) }); } catch (e) { alert(e.message); c.checked = !c.checked; } });
    v.querySelectorAll('[data-tr]').forEach(b => b.onclick = async () => { if (!confirm('Make a new PIN for this leader? Their old PIN stops working.')) return; try { const r = await hubCall({ action: 'leaderReset', id: b.dataset.tr }); showPin(r.name, r.pin); } catch (e) { alert(e.message); } });
    v.querySelectorAll('[data-tx]').forEach(b => b.onclick = async () => { if (!confirm('Remove this leader? They lose access right away.')) return; try { await hubCall({ action: 'leaderRemove', id: b.dataset.tx }); await hubFeed(true); render(); } catch (e) { alert(e.message); } });
    applyLang();
  });
}


/* ---------- Family registration (parent leaves a contact; only the admin can read it) ---------- */
const firstWord = n => String(n || '').trim().split(/\s+/)[0] || '';
function famCard(list) {
  const todo = list.filter(p => !p.fam), done = list.filter(p => p.fam), last = JSON.parse(lsGet('agc.fam.contact', '{}') || '{}');
  return `<div class="card gold"><h2>Register your family with the church</h2>
    <p class="muted">So the church knows who has joined and can reach you about your child's classes and events.</p>
    ${done.map(p => `<div class="slot"><div class="t">✅ ${esc(firstWord(p.name))} ${esc(p.fam.li)}. <span class="muted">is registered</span></div><button class="btn small ghost" data-fx="${p.id}">Remove</button></div>`).join('')}
    ${todo.length ? `<label for="fc">Child</label><select id="fc">${todo.map(p => `<option value="${p.id}">${esc(firstWord(p.name))}</option>`).join('')}</select>
      <label for="fl">Last name starts with (one letter)</label><input id="fl" maxlength="1" autocomplete="off" style="display:block;max-width:80px;text-transform:uppercase">
      <label for="fe">Parent or guardian email</label><input id="fe" type="email" autocomplete="email" maxlength="100" value="${esc(last.e || '')}">
      <label for="fp">Parent or guardian phone</label><input id="fp" type="tel" autocomplete="tel" maxlength="20" value="${esc(last.p || '')}">
      <label class="chk"><input type="checkbox" id="fk"> I am this child's parent or guardian. I agree to share my email and phone number with Awakening Generations Church leaders so they can contact me. Only the church admin can see them, and I can remove them here at any time.</label>
      <button class="btn" id="fgo">Register</button>` : ''}
    <div id="fmsg" aria-live="polite"></div></div>`;
}
function wireFam(v, g) {
  const go = $('#fgo', v);
  if (go) go.onclick = async () => {
    const p = S.profiles.find(x => x.id === $('#fc', v).value), m = $('#fmsg', v); if (!p) return;
    const e = $('#fe', v).value.trim(), ph = $('#fp', v).value.trim(), li = $('#fl', v).value.trim();
    if (!li) { m.innerHTML = '<span class="bad">Please enter the first letter of the last name.</span>'; return; }
    if (!$('#fk', v).checked) { m.innerHTML = '<span class="bad">Please tick the box to agree.</span>'; return; }
    go.disabled = true;
    try {
      await hubCall({ action: 'famRegister', childId: p.id, deviceId: deviceId(), group: p.group, childFirst: firstWord(p.name), lastInitial: li, email: e, phone: ph, consent: true });
      p.fam = { at: new Date().toISOString(), li: li.slice(0, 1).toUpperCase() }; lsSet('agc.fam.contact', JSON.stringify({ e, p: ph })); save(); render();
    } catch (err) { go.disabled = false; m.innerHTML = `<span class="bad">${esc(err.message)}</span>`; }
  };
  v.querySelectorAll('[data-fx]').forEach(b => b.onclick = async () => {
    if (!confirm('Remove your email and phone number from the church list for this child?')) return;
    const p = S.profiles.find(x => x.id === b.dataset.fx); if (!p) return;
    try { await hubCall({ action: 'famForget', childId: p.id, deviceId: deviceId() }); delete p.fam; save(); render(); }
    catch (err) { $('#fmsg', v).innerHTML = `<span class="bad">Could not remove it right now: ${esc(err.message)} Try again with a connection.</span>`; }
  });
}
const csvCell = x => { let s = String(x == null ? '' : x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
function leadersFam(v) {
  leaderGate(v, async () => {
    if (!HUB.me.admin) { v.innerHTML = meBar() + '<div class="card"><h2>Families</h2><p>Only the pastor (admin) can see family contacts.</p></div>'; wireOut(); return; }
    v.innerHTML = '<div class="card">Loading…</div>';
    let d; try { d = await hubCall({ action: 'famList' }); } catch (e) { v.innerHTML = `<div class="card"><span class="bad">${esc(e.message)}</span></div>`; return; }
    const rows = d.rows || [], by = k => rows.filter(r => r.grp === k), mails = list => [...new Set(list.map(r => r.parentEmail))].join(', ');
    v.innerHTML = `${meBar()}<div class="card gold"><h2>Families</h2><p>Kids: <b>${by('kids').length}</b> · Youth: <b>${by('youth').length}</b> registered. Only you can see this page. Please keep these contacts private.</p>
      <div class="row"><button class="btn small" data-cp="kids">Copy Kids emails</button> <button class="btn small" data-cp="youth">Copy Youth emails</button> <button class="btn small ghost" data-cp="all">Copy all emails</button> <button class="btn small ghost" id="fcsv">Download list (CSV)</button></div><div id="fmsg" aria-live="polite"></div></div>
      <div class="card">${rows.length ? rows.map(r => `<div class="slot"><div class="t">${esc(r.childFirst)} ${esc(r.lastInitial)}. <span class="muted">${r.grp === 'youth' ? 'Youth' : 'Kids'} · ${esc((r.created || '').slice(0, 10))}</span><div><a href="mailto:${esc(r.parentEmail)}">${esc(r.parentEmail)}</a> · <a href="tel:${esc(String(r.parentPhone).replace(/[^\d]/g, ''))}">${esc(r.parentPhone)}</a></div></div><button class="btn small ghost" data-fr="${esc(r.id)}">Remove</button></div>`).join('') : '<p class="muted">No families have registered yet.</p>'}</div>`;
    wireOut();
    v.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => { const k = b.dataset.cp, txt = mails(k === 'all' ? rows : by(k)); try { await navigator.clipboard.writeText(txt); $('#fmsg', v).innerHTML = '<span class="good">Copied. Paste them into the BCC line of an email.</span>'; } catch (e) { prompt('Copy these emails:', txt); } });
    $('#fcsv', v).onclick = () => {
      const csv = ['Child,Last initial,Group,Parent email,Parent phone,Registered', ...rows.map(r => [r.childFirst, r.lastInitial, r.grp, r.parentEmail, r.parentPhone, (r.created || '').slice(0, 10)].map(csvCell).join(','))].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'agc-families.csv'; document.body.appendChild(a); a.click(); a.remove();
    };
    v.querySelectorAll('[data-fr]').forEach(b => b.onclick = async () => { if (!confirm('Remove this family from the list?')) return; try { await hubCall({ action: 'famRemove', id: b.dataset.fr }); leadersFam(v); } catch (e) { alert(e.message); } });
    applyLang();
  });
}

/* calendar buttons work anywhere in the page */
$('#view').addEventListener('click', e => {
  const btn = e.target.closest('[data-cal]'); if (!btn) return;
  const ev = CAL[btn.dataset.cal]; if (!ev) return;
  if (btn.dataset.k === 'g') window.open(gcalUrl(ev), '_blank', 'noopener'); else downloadIcs(ev);
});

/* ---------- Tidy long screens: fold the rarely used cards into tap-to-open sections ---------- */
const FOLDS = {
  'kids.me': /^(Share progress|Add a child)/, 'youth.me': /^(Share progress|Add a (child|profile|youth))/,
  'worship.songs': /^More Nepali songs/, 'leaders.res': /^Bible study and preaching tools/, 'leaders.post': /^(Posted announcements|Events$|Songs$|Fellowship posts)/
};
function foldCards() {
  const v = $('#view'); if (!v) return; const re = FOLDS[sec + '.' + tabOf[sec]]; if (!re) return;
  const cards = [...v.children].filter(c => c.classList && c.classList.contains('card')); if (cards.length < 3) return;
  cards.forEach(c => {
    const h = c.querySelector(':scope > h2'); if (!h || !re.test(h.textContent.trim()) || c.dataset.folded) return;
    const d = document.createElement('details'); d.className = c.className; d.dataset.folded = '1'; const sm = document.createElement('summary'); sm.innerHTML = '<b>' + h.innerHTML + '</b>'; d.appendChild(sm);
    h.remove(); while (c.firstChild) d.appendChild(c.firstChild); c.replaceWith(d);
  });
}
{ let ft = 0; new MutationObserver(() => { clearTimeout(ft); ft = setTimeout(foldCards, 30); }).observe(document.getElementById('view'), { childList: true }); }
const VIEWS = {
  'home.today': homeToday, 'home.mv': homeMV, 'home.e4': homeE4,
  'prayer.chain': prayerEmbed, 'worship.songs': worshipSongs, 'worship.news': worshipNews, 'worship.cal': worshipCal, 'worship.fellow': worshipFellow,
  'leaders.post': leadersPost, 'leaders.growth': leadersGrowth, 'leaders.res': leadersRes, 'leaders.lboard': leadersBoard, 'leaders.team': leadersTeam, 'leaders.fam': leadersFam,
  'kids.verse': v => memorize(v, 'kids'), 'kids.games': kidsGames, 'kids.fun': v => funView(v, 'kids'), 'youth.fun': v => funView(v, 'youth'), 'youth.games': youthGames, 'kids.lesson': shineText('kids', 'lesson', DEFAULT_LESSON.kids), 'kids.hw': v => assignView(v, 'kids'), 'kids.teach': v => teacherView(v, 'kids'),
  'kids.chat': v => chatView(v, 'kids'), 'kids.news': v => groupNews(v, 'kids'), 'kids.me': v => profilesTab(v, 'kids'),
  'youth.verse': v => memorize(v, 'youth'), 'youth.lesson': shineText('youth', 'lesson', DEFAULT_LESSON.youth), 'youth.hw': v => assignView(v, 'youth'), 'youth.teach': v => teacherView(v, 'youth'), 'youth.notes': v => notesView(v, 'youth'),
  'youth.chat': v => chatView(v, 'youth'), 'youth.news': v => groupNews(v, 'youth'), 'youth.me': v => profilesTab(v, 'youth'),
  'bible.read': bibleRead, 'bible.find': bibleFind, 'bible.notes': v => notesView(v, 'bible')
};

/* ---------- header: logo/brand and Back button go Home ---------- */
$('#brandlink').onclick = goHome; $('#homebtn').onclick = goHome;
document.querySelectorAll('.langtog').forEach(b => b.onclick = () => setLang(LANG === 'ne' ? 'en' : 'ne'));

/* ---------- start + member password ---------- */
function startApp() { S.lang = LANG; if (hubOn() && !HUB.me) S.leader = false; $('#gate').hidden = true; $('#auth').hidden = true; $('#app').hidden = false; $('#signout').hidden = !(CLOUD && ME); render(); }

/* sign-in screen (parents) */
let authMode = 'in';
function showAuth(msg, lock) {
  $('#gate').hidden = true; $('#app').hidden = true; $('#auth').hidden = false;
  $('#au-msg').innerHTML = msg ? `<span class="bad">${esc(msg)}</span>` : '';
  $('#au-go').disabled = !!lock;
}
function setAuthMode(m) {
  authMode = m;
  $('#au-in').className = 'btn small' + (m === 'in' ? '' : ' ghost'); $('#au-up').className = 'btn small' + (m === 'up' ? '' : ' ghost');
  $('#au-go').textContent = m === 'in' ? 'Sign in' : 'Create account';
  $('#au-consent').hidden = m !== 'up'; $('#au-forgot').hidden = m !== 'in';
  $('#pw2').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('#au-msg').innerHTML = '';
}
function wireAuth() {
  $('#au-in').onclick = () => setAuthMode('in'); $('#au-up').onclick = () => setAuthMode('up');
  const go = async () => {
    const email = $('#em').value.trim(), pw = $('#pw2').value;
    if (!email || !pw) { $('#au-msg').innerHTML = '<span class="bad">Please enter your email and password.</span>'; return; }
    if (authMode === 'up' && !$('#au-ck').checked) { $('#au-msg').innerHTML = '<span class="bad">Please check the box to continue.</span>'; return; }
    $('#au-go').disabled = true; $('#au-msg').textContent = 'One moment…';
    try { await (authMode === 'in' ? CLOUD.signIn(email, pw) : CLOUD.signUp(email, pw)); $('#au-msg').textContent = ''; $('#pw2').value = ''; }
    catch (e) { $('#au-msg').innerHTML = `<span class="bad">${esc(authMsg(e))}</span>`; }
    $('#au-go').disabled = false;
  };
  $('#au-go').onclick = go; $('#pw2').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#au-forgot').onclick = async () => {
    const email = $('#em').value.trim();
    if (!email) { $('#au-msg').innerHTML = '<span class="bad">Type your email above first.</span>'; return; }
    try { await CLOUD.reset(email); $('#au-msg').innerHTML = '<span class="good">If that email has an account, a reset link is on its way.</span>'; }
    catch (e) { $('#au-msg').innerHTML = `<span class="bad">${esc(authMsg(e))}</span>`; }
  };
  $('#signout').onclick = async () => {
    await flushCloud();
    try { await CLOUD.signOut(); } catch (e) {}
  };
}
async function afterGate() {
  const fb = CFG.firebase || {};
  const wanted = !!(fb.apiKey && fb.projectId);
  if (window.__agcCloud) CLOUD = window.__agcCloud;
  else if (wanted) { try { CLOUD = await makeFirebase(fb); } catch (e) { CLOUD = null; } }
  if (!CLOUD) { if (wanted) { wireAuth(); return showAuth('Sign-in is not available right now. Please check your internet and reload.', true); } return startApp(); }
  wireAuth(); setAuthMode('in');
  CLOUD.onAuth(async u => {
    if (!u) {
      if (ME && !syncErr) { try { localStorage.removeItem(KEY); } catch (e) {} }
      ME = null; KEY = KEYBASE; S = blank(); syncErr = false; return showAuth('');
    }
    ME = u; KEY = KEYBASE + '.' + u.uid; S = loadState();
    try {
      const d = await CLOUD.load(u.uid);
      if (d && d.profiles) { S.profiles = d.profiles; S.cur = d.cur || {}; S.notes = d.notes || S.notes; localSave(); }
      else if (S.profiles.length || S.notes.length) await CLOUD.save(u.uid, pack());
      syncErr = false;
    } catch (e) { syncErr = true; }
    startApp();
  });
}
(async function init() {
  CFG = Object.assign(CFG, (await getJson('data/config.json')) || {});
  NE = ((await getJson('data/i18n.json')) || {}).ne || {}; S.lang = LANG; applyLang();
  SHINE = (await getJson('data/shine.json')) || SHINE; PRAYER = (await getJson('data/prayer.json')) || PRAYER;
  WORSHIP = Object.assign({ announcements: [], songs: [], events: [], board: [] }, (await getJson('data/worship.json')) || {});
  ASK = (await getJson('data/ask.json')) || ASK;
  HOME = (await getJson('data/home.json')) || HOME; VOTD = (await getJson('data/votd.json')) || VOTD; GAMES = (await getJson('data/games.json')) || GAMES;
  if (hubOn()) { await Promise.race([hubFeed(), new Promise(r => setTimeout(r, 2500))]); }
  const hash = (CFG.passwordSha256 || '').toLowerCase();
  let ok = !hash;
  try { ok = ok || sessionStorage.getItem('agc.ok') === hash; } catch (e) {}
  if (ok) return afterGate();
  $('#gate').hidden = false;
  const tryPw = async () => {
    if ((await sha256($('#pw').value)) === hash) { try { sessionStorage.setItem('agc.ok', hash); } catch (e) {} afterGate(); }
    else $('#pwmsg').textContent = 'That password is not right.';
  };
  $('#pwgo').onclick = tryPw; $('#pw').onkeydown = e => { if (e.key === 'Enter') tryPw(); };
})();

/* ---------- Fun Zone: earn stars by learning verses, spend them on a timed play session ---------- */
const FUNCFG = g => Object.assign({ cost: g === 'youth' ? 40 : 50, minutes: 30 }, ((CFG.fun || {})[g]) || {});
let FUNT = null;
const FUNPREM = [{ k: 'asmr', title: '🫧 3D Calm Bubbles', blurb: 'A slow, relaxing 3D game: float through soft glowing bubbles and pop them with gentle sounds.', get fn() { return funAsmr; } }, { k: 'studio', title: '🧰 3D Workshop', blurb: 'Build with 3D bricks, find places on a map of the Holy Land, explore the planets and stack a math tower.', get fn() { return funStudio; } }, { k: 'world', title: '🌍 Bible Worlds', blurb: 'Pick a Bible character and explore their 3D world. Look all around and find things from their story!', get fn() { return funWorld; } }];
const FUNGAMES = [['race', '🛻 Truck Race'], ['catch', '⭐ Star Catch'], ['ttt', '⭕ Tic-Tac-Toe'], ['scramble', '🔤 Word Scramble'], ['simon', '🎵 Simon Pattern'], ['puzzle', '🧩 Puzzle'], ['memory', '🃏 Memory Match'], ['quiz', '❓ Quiz Rush'], ['dove', '🕊️ Dove Tap']];
const monthKey = () => todayKey().slice(0, 7);
const spentNow = p => (p.spentWk && String(p.spentWk.wk).startsWith(monthKey()) ? p.spentWk.n : 0);
const monthStars = p => Math.max(0, (Array.isArray(p.log) ? p.log : []).filter(x => String(x.d).startsWith(monthKey())).reduce((a, x) => a + (x.n || 0), 0));
const starBal = p => Math.max(0, monthStars(p) - spentNow(p)); // points stay all month and start again on the 1st
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function stopFun() { if (FUNT) { clearInterval(FUNT); FUNT = null; } if (window.__funRaf) { cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; } }
function funView(v, g) {
  stopFun();
  const p = needProfile(v, g); if (!p) return;
  const C = FUNCFG(g), now = Date.now(), left = (p.funUntil || 0) - now, bal = starBal(p);
  const PR = FUNPREM.map(P => Object.assign({}, P, { A: Object.assign({ cost: 100, minutes: 30 }, ((CFG.fun || {})[P.k]) || {}), left: (p[P.k + 'Until'] || 0) - now }));
  const act = PR.find(P => P.left > 0);
  if (act && left <= 0) {
    v.innerHTML = profileBar(g) + `<div class="card gold"><h2>${act.title}</h2><p>Time left: <b id="funclock">${fmtClock(act.left)}</b></p><p class="muted">⭐ ${p[act.k + 'Cost'] || act.A.cost} stars were used for this ${act.A.minutes}-minute session. Stars left this month: ${bal}</p><button class="btn small ghost" id="funmute">${FUNMUTE() ? '🔇 Sound off' : '🔊 Sound on'}</button></div><div class="card"><div id="funarea"></div></div>`;
    wireBar(g); $('#funmute').onclick = e => { lsSet('agc.mute', FUNMUTE() ? '' : '1'); e.target.textContent = FUNMUTE() ? '🔇 Sound off' : '🔊 Sound on'; funSnd('ok'); };
    window.__funGen = (window.__funGen || 0) + 1; act.fn($('#funarea'), g);
    FUNT = setInterval(() => {
      if (!v.isConnected || !$('#funclock')) return stopFun();
      const l = (p[act.k + 'Until'] || 0) - Date.now();
      if (l <= 0) { stopFun(); window.__funGen++; funView(v, g); applyLang(); } else $('#funclock').textContent = fmtClock(l);
    }, 1000);
    return;
  }
  if (left > 0) {
    v.innerHTML = profileBar(g) + `<div class="card gold"><h2>🎮 Fun Zone</h2><p>Time left: <b id="funclock">${fmtClock(left)}</b></p><p class="muted">⭐ ${C.cost} stars were used to unlock this ${C.minutes}-minute session. Stars left this month: ${bal}</p><button class="btn small ghost" id="funmute">${FUNMUTE() ? '🔇 Sound off' : '🔊 Sound on'}</button></div>
      <div class="card"><div class="bubs">${FUNGAMES.map(([k, n]) => { const [em, ...rest] = n.split(' '); return `<button class="bub ${k === 'race' ? 'on' : ''}" data-fg="${k}"><span class="bi">${em}</span><span class="bn">${rest.join(' ')}</span></button>`; }).join('')}</div><div id="funarea"></div></div>`;
    wireBar(g); $('#funmute').onclick = e => { lsSet('agc.mute', FUNMUTE() ? '' : '1'); e.target.textContent = FUNMUTE() ? '🔇 Sound off' : '🔊 Sound on'; funSnd('ok'); };
    const area = $('#funarea'); let cur = 'race';
    const open = k => { window.__funGen = (window.__funGen || 0) + 1; cur = k; v.querySelectorAll('[data-fg]').forEach(b => b.classList.toggle('on', b.dataset.fg === k)); window.__funRaf && cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; ({ race: funRace, catch: funCatch, ttt: funTtt, scramble: funScramble, simon: funSimon, puzzle: funPuzzle, memory: funMemory, quiz: funQuiz, dove: funDove })[k](area, g); applyLang(); if (k === 'race' || k === 'catch') setTimeout(() => { const c = area.querySelector('canvas'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60); };
    v.querySelectorAll('[data-fg]').forEach(b => b.onclick = () => open(b.dataset.fg));
    open(cur);
    FUNT = setInterval(() => {
      if (!v.isConnected || !$('#funclock')) return stopFun();
      const l = (p.funUntil || 0) - Date.now();
      if (l <= 0) { stopFun(); funView(v, g); applyLang(); } else $('#funclock').textContent = fmtClock(l);
    }, 1000);
    return;
  }
  const ok = bal >= C.cost;
  v.innerHTML = profileBar(g) + `<div class="card gold"><h2>🎮 Fun Zone</h2>
    <p>Learn memory verses to earn ⭐ stars. Spend <b>${C.cost} stars</b> to unlock <b>${C.minutes} minutes</b> of fun games: car racing, puzzles and more.</p>
    <p>Your stars this month: <b>⭐ ${bal}</b> of ${C.cost}</p><p class="muted">Your stars stay with you all month and start again on the 1st.</p>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${C.cost}" aria-valuenow="${Math.min(bal, C.cost)}" style="background:#e3e8ef;border-radius:8px;height:12px;overflow:hidden"><div style="background:var(--gold);height:100%;width:${Math.min(100, Math.round(bal / C.cost * 100))}%"></div></div>
    ${p.funUntil ? `<p class="good"><b>Play time is over.</b> ${p.funCost || C.cost} stars were used for that session. Stars left this month: ${bal}</p>` : ''}
    <button class="btn" id="funstart" ${ok ? '' : 'disabled'} style="margin-top:12px">${ok ? 'Unlock ' + C.minutes + ' minutes' : 'Keep learning verses to unlock'}</button></div>
    <div class="card gold"><h2>✨ Special games</h2><div class="bubs">${PR.map(P => { const [em, ...rest] = P.title.split(' '); return `<button class="bub ${bal >= P.A.cost ? '' : 'lock'}" data-prem="${P.k}" ${bal >= P.A.cost ? '' : 'disabled'}><span class="bi">${em}</span><span class="bn">${rest.join(' ')}</span><span class="bc">${P.A.cost} ⭐</span></button>`; }).join('')}</div>
      <p class="muted">${PR.map(P => `${P.title}: ${P.blurb}`).join(' ')} Each costs ${PR[0].A.cost} stars for ${PR[0].A.minutes} minutes. Your stars this month: ⭐ ${bal}.${bal < PR[0].A.cost ? ' Keep earning stars to unlock them.' : ' Tap one to unlock it.'}</p></div>`;
  wireBar(g);
  v.querySelectorAll('[data-prem]').forEach(b => b.onclick = () => { const P = PR.find(x => x.k === b.dataset.prem); if (starBal(p) < P.A.cost) return; p.spentWk = { wk: monthKey(), n: spentNow(p) + P.A.cost }; p[P.k + 'Until'] = Date.now() + P.A.minutes * 60000; p[P.k + 'Cost'] = P.A.cost; save(); funView(v, g); applyLang(); });
  $('#funstart').onclick = () => { if (starBal(p) < C.cost) return; p.spentWk = { wk: monthKey(), n: spentNow(p) + C.cost }; p.funUntil = Date.now() + C.minutes * 60000; p.funCost = C.cost; save(); funView(v, g); applyLang(); };
}
function funPuzzle(area, g) {
  const n = g === 'youth' ? 4 : 3; let tiles = [...Array(n * n).keys()].map(i => (i + 1) % (n * n)), moves = 0;
  const nb = i => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n);
  let z = tiles.indexOf(0), prev = -1;
  for (let k = 0; k < n * n * 25; k++) { const o = nb(z).filter(j => j !== prev), j = o[Math.floor(Math.random() * o.length)]; [tiles[z], tiles[j]] = [tiles[j], tiles[z]]; prev = z; z = j; }
  const draw = () => {
    const done = tiles.every((x, i) => x === (i + 1) % (n * n));
    area.innerHTML = `<p>Slide the numbers into order 1, 2, 3… Moves: <b>${moves}</b></p><div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:6px;max-width:${n * 72}px">${tiles.map((x, i) => `<button class="btn ${x ? '' : 'ghost'}" data-i="${i}" style="min-height:64px;font-size:22px;padding:0" ${x ? '' : 'disabled aria-label="empty"'}>${x || ''}</button>`).join('')}</div>${done ? `<p class="good"><b>Solved in ${moves} moves! 🎉</b></p>` : ''}<button class="btn ghost small" id="pz" style="margin-top:10px">New puzzle</button>`;
    $('#pz').onclick = () => funPuzzle(area, g);
    if (done) { funWin(area); return; }
    area.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const i = +b.dataset.i, e = tiles.indexOf(0); if (nb(i).includes(e)) { [tiles[i], tiles[e]] = [tiles[e], tiles[i]]; moves++; funSnd('tick'); draw(); } });
  };
  draw();
}
// Memory Match: match a Bible picture with its story or verse. Kids find 8 pairs, Youth 12.
const MEMPAIRS = [['⛵', 'Noah'], ['🦁', 'Daniel'], ['🐋', 'Jonah'], ['🪨', 'David'], ['🔥', 'Burning bush'], ['🪜', 'Jacob'], ['🧥', 'Joseph'], ['🍞', 'Feeding 5,000'],
  ['🐑', 'Psalm 23'], ['🌈', 'Genesis 9'], ['⭐', 'Wise men'], ['🌊', 'Red Sea']];
function funMemory(area, g) {
  const pairs = g === 'youth' ? 12 : 8, cols = g === 'youth' ? 4 : 4, flip = g === 'youth' ? 650 : 800, G = window.__funGen;
  const deck = []; MEMPAIRS.slice(0, pairs).forEach(([e, n], k) => { deck.push({ k, t: e, big: true }, { k, t: n }); });
  deck.sort(() => Math.random() - .5); let open = [], found = 0, tries = 0, lock = false; const key = 'memory', rec = () => +lsGet('agc.bestlow.' + key + '.' + g, 0) || 0;
  const draw = () => {
    const best = rec();
    area.innerHTML = `<p>Match each picture with its Bible story or verse. Tries: <b>${tries}</b>${best ? ` · 🏆 Best ${best}` : ''}</p><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;max-width:340px">${deck.map((c, i) => { const up = c.up || open.includes(i); return `<button class="btn ${up ? '' : 'ghost'}" data-i="${i}" style="min-height:62px;font-size:${up && !c.big ? 12 : 26}px;padding:2px;line-height:1.1;overflow-wrap:anywhere" aria-label="card">${up ? esc(c.t) : '?'}</button>`; }).join('')}</div>${found === pairs ? `<p class="good"><b>All ${pairs} pairs found in ${tries} tries! 🎉</b></p>` : ''}<button class="btn ghost small" id="mm" style="margin-top:10px">New game</button>`;
    $('#mm').onclick = () => funMemory(area, g);
    if (found === pairs) { if (!best || tries < best) lsSet('agc.bestlow.' + key + '.' + g, String(tries)); funWin(area); }
    area.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const i = +b.dataset.i; if (lock || deck[i].up || open.includes(i)) return; open.push(i);
      if (open.length === 2) { tries++; const [x, y] = open; if (deck[x].k === deck[y].k) { deck[x].up = deck[y].up = true; found++; funSnd('ok'); open = []; } else { lock = true; funSnd('bad'); draw(); return void setTimeout(() => { open = []; lock = false; if (area.isConnected && G === window.__funGen) draw(); }, flip); } }
      draw();
    });
  };
  draw();
}

/* ---------- more Fun Zone games ---------- */
function funTruck(cx, x, y, w, h) { // top-down blue pickup truck, front at the top (no brand badge)
  cx.fillStyle = '#111'; [[-3, 8], [-3, h - 24], [w - 4, 8], [w - 4, h - 24]].forEach(([dx, dy]) => cx.fillRect(x + dx, y + dy, 7, 15));
  cx.fillStyle = '#0d47a1'; cx.fillRect(x, y, w, h);
  cx.fillStyle = '#5b9bff'; cx.fillRect(x + 4, y + 4, w - 8, 8);
  cx.fillStyle = '#ffeb3b'; cx.fillRect(x + 3, y, 9, 4); cx.fillRect(x + w - 12, y, 9, 4);
  cx.fillStyle = '#0a1d3a'; cx.fillRect(x + 5, y + 14, w - 10, 7);
  cx.fillStyle = '#1565c0'; cx.fillRect(x + 4, y + 21, w - 8, 15);
  cx.fillStyle = '#0a1d3a'; cx.fillRect(x + 5, y + 36, w - 10, 4);
  cx.fillStyle = '#08306b'; cx.fillRect(x + 4, y + 43, w - 8, h - 49);
  cx.strokeStyle = '#0d47a1'; cx.lineWidth = 1; for (let k = 1; k < 4; k++) { cx.beginPath(); cx.moveTo(x + 4, y + 43 + k * (h - 49) / 4); cx.lineTo(x + w - 4, y + 43 + k * (h - 49) / 4); cx.stroke(); }
  cx.fillStyle = '#cfd8dc'; cx.fillRect(x + 2, y + h - 4, w - 4, 4);
}

/* ---------- sound, confetti, helpers ---------- */
let FUNAC = null;
const FUNMUTE = () => lsGet('agc.mute', '') === '1';
function funSnd(k) {
  if (FUNMUTE()) return;
  try {
    FUNAC = FUNAC || new (window.AudioContext || window.webkitAudioContext)(); if (FUNAC.state === 'suspended') FUNAC.resume();
    const M = { coin: [[880, .07], [1320, .1]], ok: [[660, .09], [990, .12]], win: [[523, .12], [659, .12], [784, .12], [1047, .35]], crash: [[200, .25, 'sawtooth'], [90, .45, 'sawtooth']], level: [[600, .09], [800, .09], [1000, .16]], nitro: [[400, .07], [700, .07], [1100, .22]], tick: [[520, .05]], bad: [[220, .2, 'square']], c: [[262, .25]], d: [[330, .25]], e: [[392, .25]], f: [[523, .25]] };
    let at = FUNAC.currentTime; (M[k] || []).forEach(([f, d, ty]) => { const o = FUNAC.createOscillator(), v = FUNAC.createGain(); o.type = ty || 'sine'; o.frequency.value = f; v.gain.setValueAtTime(.12, at); v.gain.exponentialRampToValueAtTime(.001, at + d); o.connect(v); v.connect(FUNAC.destination); o.start(at); o.stop(at + d + .02); at += d * .8; });
  } catch (e) {}
}
function funBuzz(n) { try { if (navigator.vibrate && !FUNMUTE()) navigator.vibrate(n || 30); } catch (e) {} }
function funWin(area) {
  funSnd('win'); funBuzz([40, 40, 80]);
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const em = ['🎉', '⭐', '🎊', '✨', '🌟', '💙'];
  for (let i = 0; i < 28; i++) { const e = document.createElement('span'); e.className = 'cf'; e.textContent = em[i % em.length]; e.style.left = Math.random() * 96 + '%'; e.style.animationDelay = Math.random() * .6 + 's'; e.style.fontSize = 18 + Math.random() * 16 + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 3200); }
}
const funBest = (k, g) => +lsGet('agc.best.' + k + '.' + g, 0) || 0;
function funSetBest(k, g, n) { if (n > funBest(k, g)) { lsSet('agc.best.' + k + '.' + g, String(n)); return true; } return false; }
function funBurst(parts, x, y, col, n) { for (let i = 0; i < (n || 14); i++) { const a = Math.random() * 6.28, v = 1 + Math.random() * 3.5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 24 + Math.random() * 16, c: col }); } }
function funParts(cx, parts) { for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx; q.y += q.vy; q.vy += .08; q.l--; if (q.l <= 0) { parts.splice(i, 1); continue; } cx.globalAlpha = Math.min(1, q.l / 16); cx.fillStyle = q.c; cx.fillRect(q.x, q.y, 4, 4); } cx.globalAlpha = 1; }
function funTruck(cx, x, y, w, h) { // top-down blue pickup truck, front at the top (no brand badge)
  cx.fillStyle = '#111'; [[-3, 8], [-3, h - 24], [w - 4, 8], [w - 4, h - 24]].forEach(([dx, dy]) => cx.fillRect(x + dx, y + dy, 7, 15));
  cx.fillStyle = '#0d47a1'; cx.fillRect(x, y, w, h);
  cx.fillStyle = '#5b9bff'; cx.fillRect(x + 4, y + 4, w - 8, 8);
  cx.fillStyle = '#ffeb3b'; cx.fillRect(x + 3, y, 9, 4); cx.fillRect(x + w - 12, y, 9, 4);
  cx.fillStyle = '#0a1d3a'; cx.fillRect(x + 5, y + 14, w - 10, 7);
  cx.fillStyle = '#1565c0'; cx.fillRect(x + 4, y + 21, w - 8, 15);
  cx.fillStyle = '#0a1d3a'; cx.fillRect(x + 5, y + 36, w - 10, 4);
  cx.fillStyle = '#08306b'; cx.fillRect(x + 4, y + 43, w - 8, h - 49);
  cx.strokeStyle = '#0d47a1'; cx.lineWidth = 1; for (let k = 1; k < 4; k++) { cx.beginPath(); cx.moveTo(x + 4, y + 43 + k * (h - 49) / 4); cx.lineTo(x + w - 4, y + 43 + k * (h - 49) / 4); cx.stroke(); }
  cx.fillStyle = '#cfd8dc'; cx.fillRect(x + 2, y + h - 4, w - 4, 4);
}
function funOther(cx, x, y, w, col) { cx.fillStyle = col; cx.fillRect(x, y, w, 34); cx.fillStyle = '#111'; cx.fillRect(x + 4, y + 8, w - 8, 8); cx.fillRect(x + 4, y + 24, w - 8, 5); cx.fillStyle = '#fff'; cx.fillRect(x + 2, y + 31, 6, 3); cx.fillRect(x + w - 8, y + 31, 6, 3); }
function funBanner(cx, W, txt, a) { if (a <= 0) return; cx.globalAlpha = Math.min(1, a / 20); cx.fillStyle = '#ffc107'; cx.font = 'bold 30px sans-serif'; cx.textAlign = 'center'; cx.fillText(txt, W / 2, 150 - (60 - a) * .3); cx.textAlign = 'left'; cx.globalAlpha = 1; }

/* ---------- Truck Race: collect stars, grab nitro, dodge traffic, level up ---------- */
function funRace(area, g) {
  const hard = g === 'youth', lanes = hard ? 4 : 3, W = 280, H = 360, lw = W / lanes, ty = H - 96, th = 64, tw = lw - 24;
  area.innerHTML = `<canvas id="rc" width="${W}" height="${H}" style="max-width:100%;background:#2b2b2b;border-radius:10px;touch-action:none" aria-label="Truck race"></canvas><p class="muted">Tap left or right (or use arrow keys) to steer. Grab ⭐ for points, ⚡ for NITRO (smash through traffic!). Don't crash!</p><div id="rs"></div>`;
  const cv = $('#rc'), cx = cv.getContext('2d'); let lane = Math.floor(lanes / 2), px = lane * lw + 12;
  let obs = [], coins = [], parts = [], score = 0, passed = 0, combo = 1, level = 1, speed = hard ? 4 : 2.6, t = 0, over = false, shake = 0, nitro = 0, ban = 0, banT = '', spawns = 0, best = funBest('race', g);
  const say = (s) => { banT = s; ban = 60; };
  const move = d => { if (!over) lane = Math.max(0, Math.min(lanes - 1, lane + d)); };
  cv.onpointerdown = e => { const r = cv.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); };
  const key = e => { if (!cv.isConnected) return document.removeEventListener('keydown', key); if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); };
  document.addEventListener('keydown', key);
  const spawn = () => {
    spawns++; const l = Math.floor(Math.random() * lanes);
    obs.push({ l, y: -40, k: Math.random() < .35 ? 'cone' : ['#e53935', '#ef6c00', '#eceff1', '#8e24aa'][Math.floor(Math.random() * 4)] });
    const o = (l + 1 + Math.floor(Math.random() * (lanes - 1))) % lanes;
    if (spawns % 9 === 0) coins.push({ l: o, y: -120, nitro: true }); else if (Math.random() < .7) coins.push({ l: o, y: -80 });
  };
  const hit = (l, y, h) => Math.abs(l * lw + 12 - px) < lw - 28 && y + h > ty + 4 && y < ty + th - 4;
  const end = () => {
    over = true; shake = 20; funSnd('crash'); funBuzz(200); funBurst(parts, px + tw / 2, ty + 20, '#ffc107', 30); funBurst(parts, px + tw / 2, ty + 20, '#e53935', 20);
    const nb = funSetBest('race', g, score);
    $('#rs').innerHTML = `<p><b>💥 Crash! Score ${score}</b> · Level ${level}${nb ? ' · 🏆 <b>NEW BEST!</b>' : ' · Best ' + Math.max(best, score)}</p><button class="btn" id="rr">🛻 Race again</button>`;
    $('#rr').onclick = () => funRace(area, g); if (nb && score > 0) funWin(area);
  };
  const loop = () => {
    if (!cv.isConnected) return;
    t++; const sp = speed * (nitro > 0 ? 1.7 : 1); px += (lane * lw + 12 - px) * .35;
    if (!over) {
      if (t % Math.max(hard ? 20 : 32, Math.round((hard ? 44 : 70) - level * 4 - speed * 2)) === 0) spawn();
      obs.forEach(o => o.y += sp); coins.forEach(c => c.y += sp); if (nitro > 0) { nitro--; if (nitro === 0) say('Nitro over'); }
      obs = obs.filter(o => {
        if (hit(o.l, o.y, 32)) { if (nitro > 0) { score += 3; funBurst(parts, o.l * lw + lw / 2, o.y + 10, '#ff9800', 12); funSnd('tick'); funBuzz(15); return false; } end(); return true; }
        if (o.y > H) { passed++; score++; if (passed % 8 === 0) { level++; speed += hard ? .5 : .35; say('LEVEL ' + level + '!'); funSnd('level'); } return false; }
        return true;
      });
      coins = coins.filter(c => {
        if (hit(c.l, c.y, 24)) { if (c.nitro) { nitro = 220; say('⚡ NITRO!'); funSnd('nitro'); funBuzz(40); } else { score += 5 * combo; combo = Math.min(5, combo + 1); funSnd('coin'); if (combo > 1) say('x' + combo + ' COMBO'); } funBurst(parts, c.l * lw + lw / 2, c.y + 10, c.nitro ? '#40c4ff' : '#ffd54f', 12); return false; }
        if (c.y > H) { if (!c.nitro) combo = 1; return false; }
        return true;
      });
    }
    cx.save(); if (shake > 0) { cx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake--; }
    cx.fillStyle = '#2b2b2b'; cx.fillRect(-10, -10, W + 20, H + 20);
    const off = (t * sp) % 40; for (let y = -40; y < H; y += 40) { cx.fillStyle = (Math.floor((y + off) / 40) % 2) ? '#e53935' : '#fff'; cx.fillRect(0, y + off, 6, 40); cx.fillRect(W - 6, y + off, 6, 40); }
    cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.setLineDash([16, 16]); cx.lineDashOffset = -(t * sp);
    for (let i = 1; i < lanes; i++) { cx.beginPath(); cx.moveTo(i * lw, 0); cx.lineTo(i * lw, H); cx.stroke(); }
    cx.setLineDash([]);
    if (nitro > 0) { cx.strokeStyle = 'rgba(64,196,255,.55)'; for (let i = 0; i < 10; i++) { const x = (i * 53 + t * 7) % W; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); } }
    obs.forEach(o => { const x = o.l * lw + 10, w = lw - 20; if (o.k === 'cone') { cx.fillStyle = '#ff6d00'; cx.beginPath(); cx.moveTo(x + w / 2, o.y); cx.lineTo(x + w / 2 + 14, o.y + 30); cx.lineTo(x + w / 2 - 14, o.y + 30); cx.fill(); cx.fillStyle = '#fff'; cx.fillRect(x + w / 2 - 8, o.y + 14, 16, 5); } else funOther(cx, x, o.y, w, o.k); });
    cx.font = '24px sans-serif'; coins.forEach(c => cx.fillText(c.nitro ? '⚡' : '⭐', c.l * lw + lw / 2 - 12, c.y + 20));
    if (!over) { if (nitro > 0) { cx.fillStyle = (t % 4 < 2) ? '#ffab00' : '#ff3d00'; cx.beginPath(); cx.moveTo(px + 8, ty + th); cx.lineTo(px + tw - 8, ty + th); cx.lineTo(px + tw / 2, ty + th + 30 + Math.random() * 14); cx.fill(); } else if (t % 3 === 0) { parts.push({ x: px + tw / 2, y: ty + th, vx: (Math.random() - .5) * .8, vy: 1.2, l: 14, c: '#9e9e9e' }); }
      if (nitro > 0 && t % 4 < 2) { cx.globalAlpha = .35; cx.fillStyle = '#40c4ff'; cx.fillRect(px - 6, ty - 6, tw + 12, th + 12); cx.globalAlpha = 1; } funTruck(cx, px, ty, tw, th); }
    funParts(cx, parts); funBanner(cx, W, banT, ban); if (ban > 0) ban--;
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(0, 0, W, 28); cx.fillStyle = '#fff'; cx.font = 'bold 14px sans-serif'; cx.fillText('Score ' + score + (combo > 1 ? '  x' + combo : '') + '   Lv ' + level, 8, 19); cx.textAlign = 'right'; cx.fillText('🏆 ' + Math.max(best, score), W - 8, 19); cx.textAlign = 'left';
    cx.restore(); window.__funRaf = requestAnimationFrame(loop);
  };
  window.__funRaf = requestAnimationFrame(loop);
}
/* ---------- Star Catch: combos, golden stars ---------- */
function funCatch(area, g) {
  const hard = g === 'youth', W = 280, H = 360;
  area.innerHTML = `<canvas id="cc" width="${W}" height="${H}" style="max-width:100%;background:#12355b;border-radius:10px;touch-action:none" aria-label="Star catch"></canvas><p class="muted">Slide your finger (or arrow keys) to catch ⭐. 🌟 gold is worth 5! Chain catches for a bigger combo. Avoid the ${hard ? 'dark clouds' : 'rocks'}!</p><div id="cs2"></div>`;
  const cv = $('#cc'), cx = cv.getContext('2d'); let bx = W / 2, tx = W / 2, items = [], parts = [], stars = [], score = 0, lives = 3, t = 0, over = false, streak = 0, ban = 0, banT = '', best = funBest('catch', g);
  for (let i = 0; i < 30; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.2 + .3 });
  const setX = c => { const r = cv.getBoundingClientRect(); tx = Math.max(28, Math.min(W - 28, (c - r.left) / r.width * W)); };
  cv.onpointermove = e => setX(e.clientX); cv.onpointerdown = e => setX(e.clientX);
  const key = e => { if (!cv.isConnected) return document.removeEventListener('keydown', key); if (e.key === 'ArrowLeft') tx = Math.max(28, tx - 30); if (e.key === 'ArrowRight') tx = Math.min(W - 28, tx + 30); };
  document.addEventListener('keydown', key);
  const mult = () => Math.min(5, 1 + Math.floor(streak / 5));
  const say = s => { banT = s; ban = 50; };
  const loop = () => {
    if (!cv.isConnected) return;
    t++; bx += (tx - bx) * .4;
    if (!over) {
      if (t % (hard ? 20 : 32) === 0) { const r = Math.random(); items.push({ x: 15 + Math.random() * (W - 30), y: -10, k: r < (hard ? .35 : .22) ? 'bad' : r > .93 ? 'gold' : 'star', v: (hard ? 3 : 2.1) + score * .004 }); }
      items.forEach(o => o.y += o.v);
      items = items.filter(o => {
        if (o.y > H - 44 && o.y < H - 8 && Math.abs(o.x - bx) < 34) {
          if (o.k === 'bad') { lives--; streak = 0; funSnd('bad'); funBuzz(80); funBurst(parts, o.x, o.y, '#90a4ae', 10); }
          else { streak++; const v = (o.k === 'gold' ? 5 : 1) * mult(); score += v; funSnd(o.k === 'gold' ? 'nitro' : 'coin'); funBurst(parts, o.x, o.y, o.k === 'gold' ? '#ffd54f' : '#fff59d', 12); if (streak % 5 === 0) say('x' + mult() + ' COMBO!'); }
          return false;
        }
        if (o.y > H) { if (o.k === 'star') { lives--; streak = 0; funSnd('bad'); } return false; }
        return true;
      });
      if (lives <= 0) { over = true; funSnd('crash'); const nb = funSetBest('catch', g, score); $('#cs2').innerHTML = `<p><b>Game over! ${score} points</b>${nb ? ' · 🏆 <b>NEW BEST!</b>' : ' · Best ' + Math.max(best, score)}</p><button class="btn" id="cr">⭐ Play again</button>`; $('#cr').onclick = () => funCatch(area, g); if (nb && score > 0) funWin(area); }
    }
    cx.fillStyle = '#12355b'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#fff'; stars.forEach(s => { s.y += s.s; if (s.y > H) s.y = 0; cx.globalAlpha = .5; cx.fillRect(s.x, s.y, 2, 2); }); cx.globalAlpha = 1;
    cx.font = '26px sans-serif'; items.forEach(o => cx.fillText(o.k === 'bad' ? (hard ? '☁️' : '🪨') : o.k === 'gold' ? '🌟' : '⭐', o.x - 13, o.y + 8));
    cx.fillStyle = '#ffc107'; cx.fillRect(bx - 28, H - 30, 56, 14); cx.fillRect(bx - 28, H - 42, 6, 12); cx.fillRect(bx + 22, H - 42, 6, 12); cx.fillStyle = '#fff'; cx.fillRect(bx - 20, H - 26, 40, 3);
    funParts(cx, parts); funBanner(cx, W, banT, ban); if (ban > 0) ban--;
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.fillRect(0, 0, W, 28); cx.fillStyle = '#fff'; cx.font = 'bold 14px sans-serif'; cx.fillText('⭐ ' + score + (mult() > 1 ? ' x' + mult() : '') + '   ' + '❤️'.repeat(Math.max(0, lives)), 8, 19); cx.textAlign = 'right'; cx.fillText('🏆 ' + Math.max(best, score), W - 8, 19); cx.textAlign = 'left';
    window.__funRaf = requestAnimationFrame(loop);
  };
  window.__funRaf = requestAnimationFrame(loop);
}
/* ---------- Tic-Tac-Toe with a running scoreboard ---------- */
const FUNTT = { kids: [0, 0, 0], youth: [0, 0, 0] };
function funTtt(area, g) {
  const hard = g === 'youth', L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let b = Array(9).fill(''), end = '', counted = false;
  const win = (bd, m) => L.some(l => l.every(i => bd[i] === m));
  const full = bd => bd.every(x => x);
  const mm = (bd, m) => {
    if (win(bd, 'O')) return 1; if (win(bd, 'X')) return -1; if (full(bd)) return 0;
    const sc = bd.map((x, i) => x ? null : (() => { const c = bd.slice(); c[i] = m; return mm(c, m === 'O' ? 'X' : 'O'); })()).filter(x => x !== null);
    return m === 'O' ? Math.max(...sc) : Math.min(...sc);
  };
  const cpu = () => {
    const free = b.map((x, i) => x ? -1 : i).filter(i => i >= 0); if (!free.length) return;
    let pick;
    if (hard) { let best = -2; free.forEach(i => { const c = b.slice(); c[i] = 'O'; const v = mm(c, 'X'); if (v > best) { best = v; pick = i; } }); }
    else { const tryM = m => free.find(i => { const c = b.slice(); c[i] = m; return win(c, m); }); pick = tryM('O'); if (pick === undefined && Math.random() < .5) pick = tryM('X'); if (pick === undefined) pick = free[Math.floor(Math.random() * free.length)]; }
    b[pick] = 'O';
  };
  const draw = () => {
    if (!end) { if (win(b, 'X')) end = 'You win! 🎉'; else if (win(b, 'O')) end = 'The computer wins. Try again!'; else if (full(b)) end = "It's a tie."; }
    if (end && !counted) { counted = true; const T = FUNTT[g]; if (win(b, 'X')) { T[0]++; funWin(area); } else if (win(b, 'O')) { T[1]++; funSnd('bad'); } else { T[2]++; funSnd('ok'); } }
    const T = FUNTT[g];
    area.innerHTML = `<p>You are ❌. ${hard ? 'This computer is tough, can you tie or win?' : 'Get three in a row.'}</p><p class="muted">🏆 Wins ${T[0]} · Computer ${T[1]} · Ties ${T[2]}</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:216px">${b.map((x, i) => `<button class="btn ${x ? '' : 'ghost'}" data-i="${i}" style="min-height:64px;font-size:28px;padding:0" aria-label="square" ${x || end ? 'disabled' : ''}>${x === 'X' ? '❌' : x === 'O' ? '⭕' : ''}</button>`).join('')}</div>${end ? `<p><b>${end}</b> <button class="btn small" id="tt">Play again</button></p>` : ''}`;
    if ($('#tt')) $('#tt').onclick = () => funTtt(area, g);
    area.querySelectorAll('[data-i]').forEach(bt => bt.onclick = () => { const i = +bt.dataset.i; if (b[i] || end) return; b[i] = 'X'; funSnd('tick'); if (!win(b, 'X') && !full(b)) cpu(); draw(); });
  };
  draw();
}
/* ---------- Word Scramble: race the clock, build a streak ---------- */
function funScramble(area, g) {
  const W = g === 'youth' ? ['COVENANT', 'REDEEMER', 'SALVATION', 'SCRIPTURE', 'DISCIPLE', 'FORGIVEN', 'RIGHTEOUS', 'FELLOWSHIP', 'RESURRECTION', 'PROPHECY', 'MERCIFUL', 'SANCTIFIED'] : ['GRACE', 'FAITH', 'PRAYER', 'JESUS', 'DAVID', 'MOSES', 'NOAH', 'LOVE', 'HOPE', 'ANGEL', 'PSALM', 'SHEEP', 'SAVIOR', 'BIBLE', 'CHURCH', 'PEACE', 'MIRACLE', 'DISCIPLE', 'PARABLE', 'SHEPHERD', 'FORGIVE', 'BLESSING'], LIM = g === 'youth' ? 20 : 30;
  let score = 0, streak = 0, w, sc, hint = 0, msg = '', tm = 0, timer = null, best = funBest('scramble', g);
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const next = () => { w = W[Math.floor(Math.random() * W.length)]; do { sc = w.split('').sort(() => Math.random() - .5).join(''); } while (sc === w); hint = 0; tm = LIM; };
  const draw = () => {
    stop();
    area.innerHTML = `<p>Unscramble the Bible word! Points: <b>${score}</b> · 🔥 Streak: <b>${streak}</b> · 🏆 Best ${Math.max(best, score)}</p><div style="background:#e3e8ef;border-radius:8px;height:10px;overflow:hidden"><div id="sb" style="background:var(--gold);height:100%;width:${tm / LIM * 100}%"></div></div><p style="font-size:30px;letter-spacing:6px;font-weight:700">${sc}</p>${hint ? `<p class="muted">Hint: starts with <b>${w[0]}</b> (−3 points)</p>` : ''}<input id="sw" maxlength="20" autocomplete="off" autocapitalize="characters" aria-label="Your answer" style="text-transform:uppercase"> <button class="btn small" id="sg">Check</button> <button class="btn small ghost" id="sh">Hint</button> <button class="btn small ghost" id="sk">Skip</button><p id="sm">${msg}</p>`;
    const chk = () => { const a = $('#sw').value.trim().toUpperCase(); if (!a) return; if (a === w) { streak++; score += Math.max(1, 10 + Math.ceil(tm / 3) + streak * 2 - (hint ? 3 : 0)); funSnd('coin'); if (streak % 3 === 0) { funSnd('level'); msg = `<span class="good">🔥 ${streak} in a row! Amazing!</span>`; } else msg = '<span class="good">Correct! 🎉</span>'; if (funSetBest('scramble', g, score)) best = score; next(); draw(); } else { streak = 0; funSnd('bad'); msg = '<span class="bad">Not yet. Try again!</span>'; draw(); } };
    $('#sg').onclick = chk; $('#sw').onkeydown = e => { if (e.key === 'Enter') chk(); };
    $('#sh').onclick = () => { hint = 1; draw(); }; $('#sk').onclick = () => { streak = 0; msg = `<span class="muted">It was ${w}.</span>`; next(); draw(); };
    timer = setInterval(() => { if (!area.isConnected || !$('#sb')) return stop(); tm -= 1; if ($('#sb')) $('#sb').style.width = Math.max(0, tm / LIM * 100) + '%'; if (tm <= 5 && tm > 0) funSnd('tick'); if (tm <= 0) { streak = 0; funSnd('crash'); msg = `<span class="bad">⏰ Time's up! It was ${w}.</span>`; next(); draw(); } }, 1000);
  };
  next(); draw();
}
/* ---------- Quiz Rush: answer Bible questions fast; 3 lives ---------- */
function funQuiz(area, g) {
  const list = GAMES.whoAmI || []; if (list.length < 3) { area.innerHTML = '<p>No questions yet.</p>'; return; }
  const G = window.__funGen; let score = 0, lives = 3, streak = 0, q, opts, tm, timer = null, best = funBest('quiz', g); const LIM = g === 'youth' ? 8 : 12;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const next = () => { q = list[Math.floor(Math.random() * list.length)]; opts = q.options.slice().sort(() => Math.random() - .5); tm = LIM; };
  const miss = txt => { stop(); streak = 0; lives--; funSnd('crash'); funBuzz(120); if (lives <= 0) { if (funSetBest('quiz', g, score)) { best = score; funWin(area); } draw(txt + ' <b>Game over!</b>', true); } else { next(); draw(txt); } };
  const draw = (msg, over) => {
    stop();
    area.innerHTML = `<p>Score: <b>${score}</b> · ${'❤️'.repeat(Math.max(0, lives))} · 🔥 ${streak} · 🏆 Best ${Math.max(best, score)}</p>${over ? `<p>${msg}</p><button class="btn" id="qa">Play again</button>` : `<div style="background:#e3e8ef;border-radius:8px;height:10px;overflow:hidden"><div id="qb" style="background:var(--gold);height:100%;width:${tm / LIM * 100}%"></div></div><div class="card gold" style="margin-top:8px"><p><b>Who am I?</b> ${esc(q.clue)}</p></div>${opts.map(o => `<button class="btn ghost" data-o="${esc(o)}">${esc(o)}</button>`).join('')}<p style="min-height:22px">${msg || ''}</p>`}`;
    if (over) { $('#qa').onclick = () => funQuiz(area, g); return; }
    area.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      if (b.dataset.o === q.answer) { stop(); streak++; score += 5 + Math.ceil(tm / 2) + streak; funSnd(streak % 3 === 0 ? 'level' : 'coin'); funSetBest('quiz', g, score); next(); draw('<span class="good">Correct! 🎉</span>'); } else miss(`<span class="bad">It was ${esc(q.answer)}.</span>`);
    });
    timer = setInterval(() => { if (!area.isConnected || G !== window.__funGen || !$('#qb')) return stop(); tm--; $('#qb').style.width = Math.max(0, tm / LIM * 100) + '%'; if (tm <= 3 && tm > 0) funSnd('tick'); if (tm <= 0) miss(`<span class="bad">⏰ Time's up! It was ${esc(q.answer)}.</span>`); }, 1000);
  };
  next(); draw('');
}
/* ---------- Dove Tap: tap the doves, not the storm clouds ---------- */
function funDove(area, g) {
  const G = window.__funGen, N = g === 'youth' ? 20 : 12; let score = 0, miss = 0, left = 30, timer = null, cell = -1, kind = '', best = funBest('dove', g), over = false, mv = null;
  const stop = () => { clearInterval(timer); clearTimeout(mv); timer = null; };
  const alive = () => area.isConnected && G === window.__funGen;
  const show = () => { if (!alive() || over) return stop(); const i = Math.floor(Math.random() * 9); cell = i; kind = Math.random() < (g === 'youth' ? .3 : .2) ? 'cloud' : 'dove'; draw(); mv = setTimeout(() => { if (alive() && !over) { if (kind === 'dove') miss++; show(); } }, (g === 'youth' ? 750 : 950) - Math.min(300, score * 6)); };
  const end = () => { over = true; stop(); if (funSetBest('dove', g, score)) { best = score; funWin(area); } draw(); };
  const draw = () => {
    area.innerHTML = `<p>Tap the 🕊️ doves, not the ⛈️ clouds! Score: <b>${score}</b> · ⏱ <b>${left}</b>s · 🏆 Best ${Math.max(best, score)}</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:270px">${[...Array(9).keys()].map(i => `<button class="btn ${i === cell && !over ? '' : 'ghost'}" data-i="${i}" style="min-height:76px;font-size:34px;padding:0" aria-label="tile">${i === cell && !over ? (kind === 'dove' ? '🕊️' : '⛈️') : ''}</button>`).join('')}</div>${over ? `<p class="good"><b>Time! You scored ${score}.</b></p>` : ''}<button class="btn small" id="da" style="margin-top:10px">${over ? 'Play again' : 'Restart'}</button>`;
    $('#da').onclick = () => { stop(); funDove(area, g); };
    area.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      if (over || +b.dataset.i !== cell) return; clearTimeout(mv);
      if (kind === 'dove') { score++; funSnd('coin'); } else { score = Math.max(0, score - 3); funSnd('crash'); funBuzz(80); }
      cell = -1; draw(); mv = setTimeout(show, 250);
    });
  };
  draw(); setTimeout(show, 400);
  timer = setInterval(() => { if (!alive() || over) return stop(); left--; const el = area.querySelector('b:nth-of-type(2)'); if (left <= 0) end(); else if (el) el.textContent = left; }, 1000);
}

/* ---------- 3D Calm Bubbles: slow floating bubbles in 3D; drag to look around, tap to pop with a soft sound ---------- */
function funPop() {
  if (FUNMUTE()) return;
  try {
    FUNAC = FUNAC || new (window.AudioContext || window.webkitAudioContext)(); if (FUNAC.state === 'suspended') FUNAC.resume();
    const t = FUNAC.currentTime, n = FUNAC.createBuffer(1, Math.floor(FUNAC.sampleRate * .12), FUNAC.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = FUNAC.createBufferSource(), f = FUNAC.createBiquadFilter(), v = FUNAC.createGain(), o = FUNAC.createOscillator(), ov = FUNAC.createGain();
    s.buffer = n; f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 700; f.Q.value = 1.2; v.gain.setValueAtTime(.22, t); v.gain.exponentialRampToValueAtTime(.001, t + .12);
    s.connect(f); f.connect(v); v.connect(FUNAC.destination); s.start(t);
    o.type = 'sine'; o.frequency.setValueAtTime(420 + Math.random() * 260, t); o.frequency.exponentialRampToValueAtTime(160, t + .14); ov.gain.setValueAtTime(.07, t); ov.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(ov); ov.connect(FUNAC.destination); o.start(t); o.stop(t + .18);
  } catch (e) {}
}
function funAsmr(area, g) {
  const W = 340, H = 420, G = window.__funGen, F = 260, hues = [200, 280, 170, 320, 45, 220];
  area.innerHTML = `<p class="muted">Drag to look around. Tap a bubble to pop it. Take slow breaths. 🫧</p><canvas id="ac" width="${W}" height="${H}" style="width:100%;max-width:${W}px;border-radius:14px;touch-action:none;display:block;margin:auto"></canvas><p>Popped: <b id="apc">0</b></p>`;
  const cv = $('#ac'), cx = cv.getContext('2d'); let yaw = 0, pitch = 0, vyaw = .0016, popped = 0, rings = [], drag = null, moved = false;
  const mk = (far) => ({ x: (Math.random() - .5) * 360, y: (Math.random() - .5) * 420, z: far ? 320 + Math.random() * 120 : Math.random() * 440 - 120, r: 22 + Math.random() * 30, vx: (Math.random() - .5) * .25, vy: -.12 - Math.random() * .3, vz: (Math.random() - .5) * .15, h: hues[Math.floor(Math.random() * hues.length)], ph: Math.random() * 6.28 });
  const B = Array.from({ length: 22 }, () => mk(false));
  const proj = b => { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch); let x = b.x * cy - b.z * sy, z = b.x * sy + b.z * cy, y = b.y * cp - z * sp; z = b.y * sp + z * cp; const k = F / (F + z + 160); return { sx: W / 2 + x * k, sy: H / 2 + y * k, k, z }; };
  const stopAll = () => { if (window.__funRaf) { cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; } };
  const loop = () => {
    if (!cv.isConnected || G !== window.__funGen) return stopAll();
    if (!drag) yaw += vyaw;
    const gr = cx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b1230'); gr.addColorStop(1, '#2b1b4d'); cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    B.forEach((b, i) => { b.x += b.vx + Math.sin(performance.now() / 2200 + b.ph) * .12; b.y += b.vy; b.z += b.vz; if (b.y < -260) Object.assign(b, mk(true), { y: 260 }); });
    const L = B.map(b => ({ b, p: proj(b) })).sort((a, c) => c.p.z - a.p.z);
    L.forEach(({ b, p }) => {
      const r = b.r * p.k * 1.6; if (r < 2) return;
      const gg = cx.createRadialGradient(p.sx - r * .3, p.sy - r * .35, r * .1, p.sx, p.sy, r);
      gg.addColorStop(0, `hsla(${b.h},90%,92%,.55)`); gg.addColorStop(.6, `hsla(${b.h},80%,65%,.22)`); gg.addColorStop(1, `hsla(${b.h},90%,70%,.5)`);
      cx.fillStyle = gg; cx.beginPath(); cx.arc(p.sx, p.sy, r, 0, 6.283); cx.fill();
      cx.strokeStyle = `hsla(${b.h},90%,85%,.55)`; cx.lineWidth = 1.5; cx.stroke();
      cx.fillStyle = 'rgba(255,255,255,.7)'; cx.beginPath(); cx.ellipse(p.sx - r * .35, p.sy - r * .4, r * .18, r * .1, -.6, 0, 6.283); cx.fill();
    });
    rings = rings.filter(r => r.a > 0); rings.forEach(r => { r.r += 2.2; r.a -= .03; cx.strokeStyle = `hsla(${r.h},90%,85%,${Math.max(0, r.a)})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, 6.283); cx.stroke(); });
    window.__funRaf = requestAnimationFrame(loop);
  };
  const pos = e => { const q = cv.getBoundingClientRect(); return { x: (e.clientX - q.left) * W / q.width, y: (e.clientY - q.top) * H / q.height }; };
  cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; moved = false; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; yaw += dx * .006; pitch = Math.max(-.6, Math.min(.6, pitch + dy * .004)); drag = { x: e.clientX, y: e.clientY }; };
  cv.onpointerup = e => {
    const wasTap = drag && !moved; drag = null; if (!wasTap) return;
    const m = pos(e); const hit = B.map((b, i) => ({ b, i, p: proj(b) })).filter(o => Math.hypot(o.p.sx - m.x, o.p.sy - m.y) <= o.b.r * o.p.k * 1.6 + 6).sort((a, c) => a.p.z - c.p.z)[0];
    if (hit) { rings.push({ x: hit.p.sx, y: hit.p.sy, r: hit.b.r * hit.p.k * 1.6, a: .9, h: hit.b.h }); Object.assign(hit.b, mk(true)); popped++; $('#apc').textContent = popped; funPop(); funBuzz(15); }
  };
  loop();
}
/* ---------- Bible Worlds: pick a Bible character and look around 360 degrees in 3D to find things from the story ---------- */
const BWORLDS = [
  { id: 'noah', em: '🧔', name: 'Noah', ref: 'Genesis 6–9', sky: ['#7fb8e8', '#cfe9f7'], gr: '#5b8a4a', decor: ['☁️', '🌳', '⛰️', '☁️'], items: [
    { e: '⛵', n: 'The ark', t: 'God told Noah to build a big boat to keep his family and the animals safe.', r: 'Genesis 6:14' },
    { e: '🐘', n: 'The animals', t: 'Pairs of animals came to Noah in the ark.', r: 'Genesis 6:19-20' },
    { e: '🌧️', n: 'The rain', t: 'It rained for forty days and forty nights.', r: 'Genesis 7:12' },
    { e: '🕊️', n: 'The dove', t: 'The dove came back with a fresh olive leaf in its beak.', r: 'Genesis 8:11' },
    { e: '🙏', n: 'The thank-you', t: 'Noah built an altar and thanked God.', r: 'Genesis 8:20' },
    { e: '🌈', n: 'The rainbow', t: 'God put a rainbow in the sky as a promise.', r: 'Genesis 9:13' }] },
  { id: 'david', em: '🧑‍🦱', name: 'David', ref: '1 Samuel 16–17', sky: ['#8ec5f0', '#e8f4e4'], gr: '#6a9a3f', decor: ['☁️', '🌳', '⛰️', '🌾'], items: [
    { e: '🐑', n: 'The sheep', t: 'David took care of his father’s sheep and kept them safe.', r: '1 Samuel 17:34-35' },
    { e: '🎵', n: 'The harp', t: 'David played the harp for King Saul.', r: '1 Samuel 16:23' },
    { e: '🛡️', n: 'The giant’s armor', t: 'Goliath was a giant, but David trusted the Lord.', r: '1 Samuel 17:45' },
    { e: '🪨', n: 'Five stones', t: 'David chose five smooth stones from the brook.', r: '1 Samuel 17:40' },
    { e: '📜', n: 'The psalm', t: 'David wrote songs to God. “The Lord is my shepherd.”', r: 'Psalm 23:1' },
    { e: '👑', n: 'The crown', t: 'David became king over Israel.', r: '2 Samuel 5:3-4' }] },
  { id: 'daniel', em: '👳', name: 'Daniel', ref: 'Daniel 6', sky: ['#3a3f6b', '#b9a27a'], gr: '#a98b5a', decor: ['🏛️', '🌴', '⭐', '🏛️'], items: [
    { e: '🪟', n: 'The window', t: 'Daniel prayed at his open window, facing Jerusalem.', r: 'Daniel 6:10' },
    { e: '🙏', n: 'Three times a day', t: 'Daniel prayed to God three times a day, even when it was risky.', r: 'Daniel 6:10' },
    { e: '🦁', n: 'The lions', t: 'Daniel was put into the lions’ den.', r: 'Daniel 6:16' },
    { e: '😇', n: 'The angel', t: 'God sent His angel and shut the lions’ mouths.', r: 'Daniel 6:22' },
    { e: '👑', n: 'The king', t: 'King Darius was very glad when Daniel was safe.', r: 'Daniel 6:23' },
    { e: '📜', n: 'The letter', t: 'The king wrote that everyone should honor the God of Daniel.', r: 'Daniel 6:25-26' }] },
  { id: 'jonah', em: '🧓', name: 'Jonah', ref: 'Jonah 1–4', sky: ['#2f4a73', '#7aa3c7'], gr: '#2c6a8f', decor: ['☁️', '🌊', '🌊', '⛵'], items: [
    { e: '⛈️', n: 'The storm', t: 'God sent a great storm on the sea.', r: 'Jonah 1:4' },
    { e: '🐋', n: 'The big fish', t: 'God sent a big fish to swallow Jonah.', r: 'Jonah 1:17' },
    { e: '🙏', n: 'The prayer', t: 'Jonah prayed to God from inside the fish.', r: 'Jonah 2:1' },
    { e: '🏙️', n: 'Nineveh', t: 'Jonah went to Nineveh and gave God’s message.', r: 'Jonah 3:3-4' },
    { e: '🌿', n: 'The plant', t: 'God made a plant grow to give Jonah shade.', r: 'Jonah 4:6' },
    { e: '❤️', n: 'God’s care', t: 'God cares about everyone, even the people of Nineveh.', r: 'Jonah 4:11' }] },
  { id: 'moses', em: '👴', name: 'Moses', ref: 'Exodus 3–20', sky: ['#e8b36b', '#f6e2b3'], gr: '#c9a566', decor: ['☁️', '🌵', '⛰️', '🌵'], items: [
    { e: '🔥', n: 'The burning bush', t: 'A bush was on fire, but it did not burn up. God spoke to Moses from it.', r: 'Exodus 3:2' },
    { e: '🐍', n: 'The staff', t: 'God showed Moses a sign with his staff.', r: 'Exodus 4:3' },
    { e: '☁️', n: 'The cloud', t: 'God led His people with a cloud by day and a fire by night.', r: 'Exodus 13:21' },
    { e: '🌊', n: 'The Red Sea', t: 'The sea was divided and the people crossed on dry ground.', r: 'Exodus 14:21-22' },
    { e: '🍞', n: 'The manna', t: 'God gave the people bread from heaven to eat.', r: 'Exodus 16:15' },
    { e: '📖', n: 'God’s commands', t: 'God gave His people the Ten Commandments.', r: 'Exodus 20:1-17' }] },
  { id: 'joseph', em: '🧒', name: 'Joseph', ref: 'Genesis 37–45', sky: ['#7bb4d8', '#f2dfae'], gr: '#c2a15e', decor: ['☁️', '🌴', '🔺', '🌴'], items: [
    { e: '🧥', n: 'The coat', t: 'Joseph’s father gave him a special coat.', r: 'Genesis 37:3' },
    { e: '💭', n: 'The dreams', t: 'God gave Joseph dreams.', r: 'Genesis 37:5' },
    { e: '🐪', n: 'The traders', t: 'Joseph was taken by traders to Egypt.', r: 'Genesis 37:28' },
    { e: '🌾', n: 'The grain', t: 'Joseph stored up lots of grain in the good years.', r: 'Genesis 41:48-49' },
    { e: '👑', n: 'The ruler', t: 'Pharaoh made Joseph a ruler over Egypt.', r: 'Genesis 41:40-41' },
    { e: '🤗', n: 'Forgiving', t: 'Joseph forgave his brothers.', r: 'Genesis 45:4-5' }] }
,
  { id: 'abraham', em: '👨‍🦳', name: 'Abraham', ref: 'Genesis 12–22', sky: ['#1f2a5a', '#e0a96b'], gr: '#b58d55', decor: ['⭐', '🌵', '⛰️', '⭐'], items: [
    { e: '🛣️', n: 'The journey', t: 'God told Abraham to leave his home, and he went.', r: 'Genesis 12:1,4' },
    { e: '🌍', n: 'God’s promise', t: 'God promised to bless all the families of the earth.', r: 'Genesis 12:3' },
    { e: '⭐', n: 'The stars', t: 'God told Abraham to look at the stars. His family would be that many!', r: 'Genesis 15:5' },
    { e: '⛺', n: 'The tent', t: 'Abraham was sitting at the door of his tent when God’s visitors came.', r: 'Genesis 18:1' },
    { e: '👶', n: 'Isaac', t: 'God gave Abraham and Sarah a son named Isaac.', r: 'Genesis 21:2-3' },
    { e: '🐏', n: 'The ram', t: 'God provided a ram for the offering.', r: 'Genesis 22:13' }] },
  { id: 'esther', em: '👸', name: 'Esther', ref: 'Esther 2–8', sky: ['#c9a0dc', '#f6e3c1'], gr: '#a8486b', decor: ['🏰', '🌹', '🏛️', '🏰'], items: [
    { e: '👑', n: 'The crown', t: 'Esther became queen.', r: 'Esther 2:17' },
    { e: '📜', n: 'The message', t: 'Mordecai asked, “Who knows whether you have come to the kingdom for such a time as this?”', r: 'Esther 4:14' },
    { e: '🙏', n: 'The fast', t: 'Esther asked the people to fast and pray for her.', r: 'Esther 4:16' },
    { e: '🏰', n: 'The palace', t: 'Esther went to the king, and he welcomed her.', r: 'Esther 5:1-2' },
    { e: '🍽️', n: 'The banquet', t: 'Esther invited the king to a banquet.', r: 'Esther 5:4' },
    { e: '🎉', n: 'The joy', t: 'God’s people had gladness and joy.', r: 'Esther 8:16-17' }] },
  { id: 'ruth', em: '👩', name: 'Ruth', ref: 'Ruth 1–4', sky: ['#f4c27a', '#fdeccb'], gr: '#c4a14a', decor: ['☁️', '🌾', '🌾', '🌳'], items: [
    { e: '💛', n: 'Staying with Naomi', t: 'Ruth said to Naomi, “Where you go, I will go.”', r: 'Ruth 1:16' },
    { e: '🛣️', n: 'The road', t: 'Ruth and Naomi came to Bethlehem.', r: 'Ruth 1:19' },
    { e: '🌾', n: 'The grain', t: 'Ruth picked up leftover grain in the field.', r: 'Ruth 2:2-3' },
    { e: '🧑‍🌾', n: 'Boaz', t: 'Boaz was kind and told his workers to leave extra grain for Ruth.', r: 'Ruth 2:15-16' },
    { e: '💍', n: 'The wedding', t: 'Ruth married Boaz.', r: 'Ruth 4:13' },
    { e: '👶', n: 'Obed', t: 'Ruth and Boaz had a son named Obed. He became King David’s grandfather.', r: 'Ruth 4:13,17' }] },
  { id: 'samuel', em: '👦', name: 'Samuel', ref: '1 Samuel 1–16', sky: ['#2b2f5e', '#8fa6cf'], gr: '#6f7f5a', decor: ['⭐', '🕯️', '⛰️', '⭐'], items: [
    { e: '🙏', n: 'Hannah’s prayer', t: 'Hannah prayed for a son, and she gave him back to God.', r: '1 Samuel 1:27-28' },
    { e: '⛪', n: 'The house of God', t: 'Samuel served God in the house of the Lord.', r: '1 Samuel 2:11' },
    { e: '🛏️', n: 'The night voice', t: 'Samuel heard a voice call his name in the night.', r: '1 Samuel 3:4' },
    { e: '👂', n: 'Listening', t: 'Samuel said, “Speak, for Your servant is listening.”', r: '1 Samuel 3:10' },
    { e: '🪨', n: 'The stone', t: 'Samuel set up a stone and said, “Thus far the Lord has helped us.”', r: '1 Samuel 7:12' },
    { e: '🏺', n: 'The oil', t: 'God sent Samuel to anoint David with oil.', r: '1 Samuel 16:12-13' }] },
  { id: 'elijah', em: '🧙', name: 'Elijah', ref: '1 Kings 17–19', sky: ['#6b8fb5', '#e9d7b0'], gr: '#8a6d46', decor: ['☁️', '⛰️', '🌵', '☁️'], items: [
    { e: '🐦', n: 'The ravens', t: 'Ravens brought Elijah bread and meat.', r: '1 Kings 17:6' },
    { e: '🏺', n: 'The jar of flour', t: 'The widow’s flour and oil did not run out.', r: '1 Kings 17:14-16' },
    { e: '🔥', n: 'The fire', t: 'Fire fell from heaven on Mount Carmel.', r: '1 Kings 18:38' },
    { e: '🌧️', n: 'The rain', t: 'A big rain came after a long dry time.', r: '1 Kings 18:45' },
    { e: '🌬️', n: 'The whisper', t: 'God spoke to Elijah in a gentle whisper.', r: '1 Kings 19:12' },
    { e: '🐎', n: 'The chariot', t: 'A chariot of fire took Elijah up to heaven.', r: '2 Kings 2:11' }] },
  { id: 'mary', em: '👩‍🍼', name: 'Mary', ref: 'Luke 1–2', sky: ['#1c2650', '#6d8bd1'], gr: '#6a7d52', decor: ['⭐', '🌙', '⭐', '🏘️'], items: [
    { e: '😇', n: 'The angel', t: 'The angel Gabriel visited Mary with good news.', r: 'Luke 1:26-28' },
    { e: '🎵', n: 'Mary’s song', t: 'Mary sang, “My soul exalts the Lord.”', r: 'Luke 1:46' },
    { e: '🏘️', n: 'Bethlehem', t: 'Mary and Joseph traveled to Bethlehem.', r: 'Luke 2:4-5' },
    { e: '👶', n: 'Baby Jesus', t: 'Jesus was born and laid in a manger.', r: 'Luke 2:7' },
    { e: '🐑', n: 'The shepherds', t: 'Shepherds heard the good news of Jesus’ birth.', r: 'Luke 2:8-11' },
    { e: '⭐', n: 'The star', t: 'Wise men saw the star and brought gifts to Jesus.', r: 'Matthew 2:9-11' }] }
];
function funWorld(area, g, pickId) {
  const G = window.__funGen;
  if (!pickId) {
    area.innerHTML = `<p>Choose a Bible character. Then look all around their world and find 6 things from their story! ${g === 'youth' ? 'Youth challenge: beat the clock and avoid things that do not belong!' : ''} 🌍</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${BWORLDS.map(w => `<button class="btn ghost" data-w="${w.id}" style="min-height:72px"><span style="font-size:28px">${w.em}</span><br><b>${esc(w.name)}</b><br><span class="muted" style="font-size:11px">${esc(w.ref)}</span></button>`).join('')}</div>`;
    area.querySelectorAll('[data-w]').forEach(b => b.onclick = () => funWorld(area, g, b.dataset.w)); return;
  }
  const W0 = BWORLDS.find(w => w.id === pickId), youth = g === 'youth', TL0 = 120, Wd = 340, H = 400, F = 300, rad = Math.PI / 180;
  let TL = TL0;
  area.innerHTML = `<p><b>${W0.em} You are ${esc(W0.name)}!</b> Drag to look around. Tap things from the story. Found: <b id="wf">0</b> of 6${youth ? ' · ⏱ <b id="wt">' + TL + '</b>s' : ''}</p><canvas id="wc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;touch-action:none;display:block;margin:auto"></canvas><div class="seg" style="margin-top:8px"><button class="btn small ghost" id="wl">◀ Look left</button><button class="btn small ghost" id="wr">Look right ▶</button></div><div id="wmsg" class="card" style="min-height:54px;margin-top:8px">Find the things from ${esc(W0.name)}’s story. ${youth ? 'You have 2 minutes. ' : ''}👀</div><button class="btn small ghost" id="wb">Choose another character</button>`;
  const cv = $('#wc'), cx = cv.getContext('2d'); let yaw = 0, pitch = 0, drag = null, moved = false, found = new Set(), pulse = 0, over = false, clock = null;
  const spots = W0.items.map((it, i) => Object.assign({}, it, { az: (i * 60 + (Math.random() * 24 - 12)) * rad, el: (Math.random() * 36 - 8) * rad, d: .9 + Math.random() * .5 }));
  const DEC = ['🚗', '📱', '🎈', '⚽', '🍕', '🚲'].sort(() => Math.random() - .5).slice(0, youth ? 4 : 0);
  const decoys = DEC.map((e, i) => ({ e, az: (i * 90 + 30 + Math.random() * 30) * rad, el: (Math.random() * 30 - 8) * rad, d: 1.0 + Math.random() * .4 }));
  const decor = Array.from({ length: 16 }, (_, i) => ({ e: W0.decor[i % W0.decor.length], az: (i * 22.5 + Math.random() * 14) * rad, el: (Math.random() * 30 - 14) * rad, d: 1.3 + Math.random() * 1.4 }));
  const proj = (az, el) => { let x = Math.cos(el) * Math.sin(az), y = Math.sin(el), z = Math.cos(el) * Math.cos(az); const cy = Math.cos(-yaw), sy = Math.sin(-yaw); let x2 = x * cy + z * sy, z2 = -x * sy + z * cy; const cp = Math.cos(-pitch), sp = Math.sin(-pitch); const y2 = y * cp - z2 * sp, z3 = y * sp + z2 * cp; return z3 > .12 ? { x: Wd / 2 + x2 / z3 * F, y: H / 2 - y2 / z3 * F, z: z3 } : null; };
  const stop = () => { if (window.__funRaf) { cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; } };
  const sprite = (o, base) => { const p = proj(o.az, o.el); return p ? Object.assign(p, { s: base / o.d * Math.min(1.6, 1 / p.z) }) : null; };
  const loop = () => {
    if (!cv.isConnected || G !== window.__funGen) return stop();
    if (!drag && !found.size) yaw += .0008; pulse += .05;
    const hy = H / 2 + Math.tan(pitch) * F, sk = cx.createLinearGradient(0, 0, 0, Math.max(10, hy)); sk.addColorStop(0, W0.sky[0]); sk.addColorStop(1, W0.sky[1]); cx.fillStyle = sk; cx.fillRect(0, 0, Wd, H);
    cx.fillStyle = W0.gr; cx.fillRect(0, Math.max(0, hy), Wd, H); const sh = cx.createLinearGradient(0, hy, 0, H); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(0,0,0,.25)'); cx.fillStyle = sh; cx.fillRect(0, Math.max(0, hy), Wd, H);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    decor.map(o => ({ o, p: sprite(o, 54) })).filter(x => x.p).sort((a, b) => a.p.z - b.p.z).forEach(({ o, p }) => { cx.globalAlpha = .8; cx.font = `${Math.round(p.s)}px serif`; cx.fillText(o.e, p.x, p.y); });
    cx.globalAlpha = 1;
    decoys.forEach(o => { const p = sprite(o, 50); if (!p) return; cx.font = `${Math.round(p.s)}px serif`; cx.fillText(o.e, p.x, p.y); o._p = p; });
    spots.forEach((o, i) => { const p = sprite(o, 58); if (!p) return; const ok = found.has(i); cx.globalAlpha = ok ? .35 : 1; const sz = p.s * (ok ? 1 : 1 + Math.sin(pulse + i) * .06); cx.font = `${Math.round(sz)}px serif`; cx.fillText(o.e, p.x, p.y); if (ok) { cx.globalAlpha = 1; cx.font = `${Math.round(sz * .5)}px serif`; cx.fillText('✅', p.x + sz * .3, p.y - sz * .3); } o._p = p; });
    cx.globalAlpha = 1; cx.font = '46px serif'; cx.fillText(W0.em, Wd / 2, H - 34);
    window.__funRaf = requestAnimationFrame(loop);
  };
  const pos = e => { const q = cv.getBoundingClientRect(); return { x: (e.clientX - q.left) * Wd / q.width, y: (e.clientY - q.top) * H / q.height }; };
  cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; moved = false; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; yaw += dx * .006; pitch = Math.max(-.5, Math.min(.5, pitch + dy * .003)); drag = { x: e.clientX, y: e.clientY }; };
  cv.onpointerup = e => {
    const tap = drag && !moved; drag = null; if (!tap || over) return; const m = pos(e);
    const bad = decoys.find(o => o._p && Math.hypot(o._p.x - m.x, o._p.y - m.y) <= o._p.s * .7 + 6);
    if (bad) { TL = Math.max(0, TL - 10); funSnd('crash'); funBuzz(60); $('#wt').textContent = TL; $('#wmsg').innerHTML = `<span class="bad">${bad.e} That does not belong in ${esc(W0.name)}’s story! −10 seconds.</span>`; if (TL <= 0) endWorld(); return; }
    const hit = spots.map((o, i) => ({ o, i })).filter(({ o, i }) => o._p && !found.has(i) && Math.hypot(o._p.x - m.x, o._p.y - m.y) <= o._p.s * .7 + 6)[0]; if (!hit) return;
    found.add(hit.i); funSnd('coin'); funBuzz(20); $('#wf').textContent = found.size;
    $('#wmsg').innerHTML = `<b>${hit.o.e} ${esc(hit.o.n)}</b><br>${esc(hit.o.t)} <span class="muted">(${esc(hit.o.r)})</span>`;
    if (found.size === 6) { over = true; if (clock) clearInterval(clock); funWin(area); $('#wmsg').innerHTML += `<br><br><b class="good">🎉 You found everything in ${esc(W0.name)}’s story! Try another character.</b>`; }
  };
  const endWorld = () => { over = true; if (clock) clearInterval(clock); $('#wmsg').innerHTML = `<b class="bad">⏰ Time is up! You found ${found.size} of 6.</b> <button class="btn small" id="wretry">Try again</button>`; $('#wretry').onclick = () => { stop(); funWorld(area, g, pickId); }; funSnd('crash'); };
  if (youth) clock = setInterval(() => { if (!cv.isConnected || G !== window.__funGen) return clearInterval(clock); if (over) return; TL--; const el = $('#wt'); if (el) el.textContent = Math.max(0, TL); if (TL <= 0) endWorld(); }, 1000);
  $('#wl').onclick = () => { yaw += .5; }; $('#wr').onclick = () => { yaw -= .5; };
  $('#wb').onclick = () => { stop(); if (clock) clearInterval(clock); funWorld(area, g); };
  loop();
}
/* ---------- 3D Workshop: build with bricks, explore the Holy Land map and the planets, stack a math tower ---------- */
function ptIn(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return `rgb(${c(16)},${c(8)},${c(0)})`; }
// Draws one cube (x,y,z are cell coordinates) viewed from a corner that turns with yaw. Returns its screen polygons.
function drawCube(cx, x, y, z, col, yaw, S, ox, oy, mid, top) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (px, py, pz) => { const dx = px - mid, dy = py - mid, rx = dx * c - dy * s, ry = dx * s + dy * c; return [ox + (rx - ry) * S * .866, oy + (rx + ry) * S * .5 - pz * S * .95]; };
  const h = top === undefined ? 1 : top, p = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], B = p.map(([a, b]) => P(a, b, z)), T = p.map(([a, b]) => P(a, b, z + h)), polys = [];
  const nrm = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let k = 0; k < 4 && h > 0; k++) { const [nx, ny] = nrm[k], rx = nx * c - ny * s, ry = nx * s + ny * c; if (rx + ry > .01) { const q = [B[k], B[(k + 1) % 4], T[(k + 1) % 4], T[k]]; cx.fillStyle = shade(col, rx > ry ? .62 : .8); cx.beginPath(); q.forEach(([a, b], i) => i ? cx.lineTo(a, b) : cx.moveTo(a, b)); cx.closePath(); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1; cx.stroke(); polys.push(q); } }
  cx.fillStyle = shade(col, 1.05); cx.beginPath(); T.forEach(([a, b], i) => i ? cx.lineTo(a, b) : cx.moveTo(a, b)); cx.closePath(); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.stroke(); polys.push(T);
  if (h >= 1) { const [sx, sy] = P(x + .5, y + .5, z + h); cx.fillStyle = shade(col, 1.2); cx.beginPath(); cx.ellipse(sx, sy - 2, S * .26, S * .14, 0, 0, 6.283); cx.fill(); cx.fillStyle = shade(col, .8); cx.beginPath(); cx.ellipse(sx, sy, S * .26, S * .14, 0, 0, 3.14); cx.fill(); }
  return polys;
}
const BRICKCOL = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f5f5f5', '#6d4c41'];
const BLUEPRINTS = [
  { n: 'Noah’s Ark', t: 'Build a big boat with 3 levels, like the ark.', r: 'Genesis 6:14-16', min: 16, hi: 3 },
  { n: 'Wall of Jericho', t: 'Build a strong wall, then imagine it falling down!', r: 'Joshua 6:20', min: 14, hi: 3 },
  { n: 'Tower of Babel', t: 'Build a very tall tower.', r: 'Genesis 11:4', min: 12, hi: 6 },
  { n: 'An altar of stones', t: 'Build a small altar to thank God, like Noah did.', r: 'Genesis 8:20', min: 6, hi: 2 },
  { n: 'Nehemiah’s wall', t: 'Rebuild the wall around the city, brick by brick.', r: 'Nehemiah 6:15', min: 18, hi: 2 },
  { n: 'Solomon’s Temple', t: 'Build a great house for the Lord with a tall front.', r: '1 Kings 6:1', min: 22, hi: 4 }
];
function funBricks(area, g) {
  const G = window.__funGen, N = g === 'youth' ? 8 : 6, MAXH = 8, S = g === 'youth' ? 24 : 30, Wd = 340, H = 360, ox = Wd / 2, oy = 150, mid = N / 2;
  const H2 = () => Array.from({ length: N }, () => Array(N).fill(0)), col = Array.from({ length: N }, () => Array.from({ length: N }, () => [])); let hist = [], yaw = .6, cur = 0, mode = 'add', drag = null, moved = false, bp = BLUEPRINTS[0], polys = [], msg = '';
  const total = () => col.reduce((a, r) => a + r.reduce((b, c) => b + c.length, 0), 0), tall = () => Math.max(0, ...col.map(r => Math.max(0, ...r.map(c => c.length))));
  area.innerHTML = `<p>Tap a spot to add a brick. Drag to turn your build around. Pick a challenge, then press <b>Check</b>.</p><div class="bubs" id="bcol" style="grid-template-columns:repeat(8,1fr)">${BRICKCOL.map((c, i) => `<button class="bub ${i ? '' : 'on'}" data-c="${i}" style="min-height:34px;background:${c}" aria-label="colour ${i + 1}"></button>`).join('')}</div>
    <canvas id="bc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;touch-action:none;display:block;margin:auto;background:linear-gradient(#bfe3ff,#eef8ff)"></canvas>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0"><button class="btn small" id="bm">➕ Adding</button><button class="btn small ghost" id="bu">↩ Undo</button><button class="btn small ghost" id="bcl">🗑 Clear</button><button class="btn small ghost" id="br1">↶</button><button class="btn small ghost" id="br2">↷</button></div>
    <div class="card"><b>Challenge:</b> <select id="bsel" style="font:inherit;padding:6px;border-radius:8px">${BLUEPRINTS.map((b, i) => `<option value="${i}">${esc(b.n)}</option>`).join('')}</select><p id="bt" class="muted" style="margin:6px 0"></p><button class="btn" id="bk">Check my build</button><div id="bmsg" style="min-height:24px;margin-top:6px"></div></div>`;
  const cv = $('#bc'), cx = cv.getContext('2d'), setBt = () => { $('#bt').textContent = `${bp.t} (${bp.r}) — use at least ${bp.min} bricks and build ${bp.hi} levels high.`; }; setBt();
  const draw = () => {
    cx.clearRect(0, 0, Wd, H); const items = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) { items.push({ x, y, z: 0, g: 1 }); col[x][y].forEach((c, k) => items.push({ x, y, z: k, c })); }
    const c = Math.cos(yaw), s = Math.sin(yaw), key = o => { const dx = o.x + .5 - mid, dy = o.y + .5 - mid; return (dx * c - dy * s + dx * s + dy * c) * 100 + o.z; };
    items.sort((a, b) => (a.g ? -1e9 : 0) - (b.g ? -1e9 : 0) || key(a) - key(b)); polys = [];
    items.forEach(o => { const ps = o.g ? drawCube(cx, o.x, o.y, 0, (o.x + o.y) % 2 ? '#8bc34a' : '#9ccc65', yaw, S, ox, oy, mid, 0) : drawCube(cx, o.x, o.y, o.z, BRICKCOL[o.c], yaw, S, ox, oy, mid); polys.push({ o, ps }); });
  };
  const pos = e => { const q = cv.getBoundingClientRect(); return [(e.clientX - q.left) * Wd / q.width, (e.clientY - q.top) * H / q.height]; };
  const add = (x, y) => { if (col[x][y].length >= MAXH) { msg = 'That is as high as it can go!'; return; } col[x][y].push(cur); hist.push([x, y, 'a']); funSnd('coin'); funBuzz(10); };
  const del = (x, y) => { if (!col[x][y].length) return; const c = col[x][y].pop(); hist.push([x, y, 'r', c]); funSnd('tick'); };
  cv.onpointerdown = e => { drag = e.clientX; moved = false; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (drag === null) return; const dx = e.clientX - drag; if (Math.abs(dx) > 3) moved = true; yaw += dx * .01; drag = e.clientX; draw(); };
  cv.onpointerup = e => { const tap = drag !== null && !moved; drag = null; if (!tap) return; const [px, py] = pos(e); for (let i = polys.length - 1; i >= 0; i--) { const { o, ps } = polys[i]; if (ps.some(q => ptIn(q, px, py))) { mode === 'add' ? add(o.x, o.y) : del(o.x, o.y); draw(); return; } } };
  area.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cur = +b.dataset.c; area.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#bm').onclick = e => { mode = mode === 'add' ? 'del' : 'add'; e.target.textContent = mode === 'add' ? '➕ Adding' : '➖ Removing'; };
  $('#bu').onclick = () => { const h = hist.pop(); if (!h) return; if (h[2] === 'a') col[h[0]][h[1]].pop(); else col[h[0]][h[1]].push(h[3]); draw(); };
  $('#bcl').onclick = () => { col.forEach(r => r.forEach(c => c.length = 0)); hist = []; draw(); };
  $('#br1').onclick = () => { yaw -= Math.PI / 2; draw(); }; $('#br2').onclick = () => { yaw += Math.PI / 2; draw(); };
  $('#bsel').onchange = e => { bp = BLUEPRINTS[+e.target.value]; setBt(); $('#bmsg').textContent = ''; };
  $('#bk').onclick = () => { const n = total(), t = tall(); if (n >= bp.min && t >= bp.hi) { $('#bmsg').innerHTML = `<span class="good"><b>🎉 You built ${esc(bp.n)}!</b> ${esc(bp.r)}</span>`; funWin(area); } else $('#bmsg').innerHTML = `<span class="bad">Keep building: ${n} of ${bp.min} bricks, ${t} of ${bp.hi} levels high.</span>`; };
  draw();
}
const HLAND = { lon: [34.2, 36.0], lat: [31.0, 33.2],
  coast: [[34.27, 31.0], [34.27, 31.3], [34.5, 31.8], [34.75, 32.05], [34.85, 32.5], [35.0, 32.8], [35.1, 33.2]],
  places: [
    { n: 'Jerusalem', lon: 35.22, lat: 31.78, t: 'Solomon built the temple here.', r: '2 Chronicles 3:1' },
    { n: 'Bethlehem', lon: 35.20, lat: 31.70, t: 'Jesus was born here.', r: 'Luke 2:4-7' },
    { n: 'Nazareth', lon: 35.30, lat: 32.70, t: 'Jesus grew up in Nazareth.', r: 'Luke 2:39' },
    { n: 'Sea of Galilee', lon: 35.62, lat: 32.76, t: 'Jesus called fishermen here to follow Him.', r: 'Matthew 4:18-19' },
    { n: 'Jericho', lon: 35.46, lat: 31.86, t: 'The walls of Jericho fell down.', r: 'Joshua 6:20' },
    { n: 'Capernaum', lon: 35.57, lat: 32.9, t: 'Jesus lived in Capernaum.', r: 'Matthew 4:13' },
    { n: 'Dead Sea', lon: 35.5, lat: 31.45, t: 'The Bible also calls it the Salt Sea.', r: 'Genesis 14:3' },
    { n: 'Joppa', lon: 34.75, lat: 32.05, t: 'Jonah went down to Joppa to run away from God.', r: 'Jonah 1:3' },
    { n: 'Hebron', lon: 35.10, lat: 31.53, t: 'Abraham buried Sarah near Hebron.', r: 'Genesis 23:19' },
    { n: 'Beersheba', lon: 34.79, lat: 31.25, t: 'Abraham planted a tree in Beersheba and called on the Lord.', r: 'Genesis 21:33' }] };
function funMap(area, g) {
  const G = window.__funGen, Wd = 340, H = 380, youth = g === 'youth', L = HLAND, pl = L.places.slice(0, youth ? 10 : 5), rad = Math.PI / 180;
  let yaw = 0, tilt = .95, V = { lon: 35.1, lat: 32.1, k: 1 }, drag = null, moved = false, round = 0, score = 0, target, order, tm = 90, clock = null, over = false, flash = null;
  const next = () => { target = order[round % order.length]; };
  order = pl.slice().sort(() => Math.random() - .5);
  const proj = (lon, lat, h) => { let x = (lon - V.lon) / 0.9 * 130 * V.k, y = -(lat - V.lat) / 1.1 * 150 * V.k; const c = Math.cos(yaw), s = Math.sin(yaw), rx = x * c - y * s, ry = x * s + y * c, k = 1 + ry / 900; return [Wd / 2 + rx * k, 215 + ry * tilt * k - (h || 0)]; };
  area.innerHTML = `<p id="mq"></p><canvas id="mc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;touch-action:none;display:block;margin:auto;background:#bfe3ff"></canvas><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button class="btn small ghost" id="ml">↶ Turn</button><button class="btn small ghost" id="mr">Turn ↷</button><button class="btn small ghost" id="mt">Tilt</button><button class="btn small ghost" id="mz">🔍 Zoom</button></div><div id="mmsg" class="card" style="min-height:48px;margin-top:8px">Look at the map of the Holy Land. Tap the place you are asked to find. Use Zoom to see places that are close together.</div>`;
  const cv = $('#mc'), cx = cv.getContext('2d');
  const ask = () => { if (over) return; $('#mq').innerHTML = `Find <b>${esc(target.n)}</b>!  Found: <b>${score}</b>${youth ? ` · ⏱ <b id="mt2">${tm}</b>s` : ''}`; };
  const draw = () => {
    cx.fillStyle = '#7ec3f0'; cx.fillRect(0, 0, Wd, H);
    const poly = (pts, fill, h, line) => { cx.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = proj(lo, la, h); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.closePath(); cx.fillStyle = fill; cx.fill(); if (line) { cx.strokeStyle = line; cx.lineWidth = 1.5; cx.stroke(); } };
    const land = [...L.coast, [36.0, 33.2], [36.0, 31.0]];
    poly(land, '#6b4f2a', -14); poly(land, '#c9b46a', 0, '#7a6a2e');
    poly(land.map(([a, b]) => [a, b]), 'rgba(120,160,70,.35)', 0);
    const ell = (lon, lat, rx, ry, col) => { cx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, [x, y] = proj(lon + Math.cos(a) * rx, lat + Math.sin(a) * ry, 0); i ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.fillStyle = col; cx.fill(); };
    ell(35.58, 32.82, .1, .1, '#3d8fd6'); ell(35.5, 31.5, .09, .33, '#2f78b8');
    cx.strokeStyle = '#3d8fd6'; cx.lineWidth = 3; cx.beginPath(); [[35.57, 32.72], [35.56, 32.4], [35.5, 32.0], [35.5, 31.8]].forEach(([a, b], i) => { const [x, y] = proj(a, b, 0); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.stroke();
    cx.fillStyle = '#2f5d8a'; cx.font = 'bold 12px sans-serif'; cx.textAlign = 'center'; const [mx, my] = proj(34.5, 32.1, 0); cx.fillText('Mediterranean Sea', mx, my);
    pl.map(p => ({ p, q: proj(p.lon, p.lat, 0) })).sort((a, b) => a.q[1] - b.q[1]).forEach(({ p, q }) => { const hit = flash && flash.n === p.n; cx.fillStyle = hit ? flash.col : '#c62828'; cx.beginPath(); cx.arc(q[0], q[1] - 16, 8, 0, 6.283); cx.fill(); cx.beginPath(); cx.moveTo(q[0] - 4, q[1] - 11); cx.lineTo(q[0], q[1]); cx.lineTo(q[0] + 4, q[1] - 11); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(q[0], q[1] - 16, 3, 0, 6.283); cx.fill(); p._q = [q[0], q[1] - 12]; });
    window.__funRaf = requestAnimationFrame(() => { if (cv.isConnected && G === window.__funGen) draw(); });
  };
  const win = () => { over = true; if (clock) clearInterval(clock); funWin(area); $('#mq').innerHTML = `<b class="good">🎉 You found them all!</b> Score: ${score}`; };
  const stop = () => { if (window.__funRaf) cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; };
  cv.onpointerdown = e => { drag = [e.clientX, e.clientY]; moved = false; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; yaw += dx * .008; tilt = Math.max(.35, Math.min(1.1, tilt + dy * .004)); drag = [e.clientX, e.clientY]; };
  cv.onpointerup = e => {
    const tap = drag && !moved; drag = null; if (!tap || over) return; const q = cv.getBoundingClientRect(), mx = (e.clientX - q.left) * Wd / q.width, my = (e.clientY - q.top) * H / q.height;
    const hit = pl.filter(p => p._q && Math.hypot(p._q[0] - mx, p._q[1] - 4 - my) < 26).sort((a, b) => Math.hypot(a._q[0] - mx, a._q[1] - my) - Math.hypot(b._q[0] - mx, b._q[1] - my))[0]; if (!hit) return;
    if (hit.n === target.n) { score++; funSnd('coin'); funBuzz(15); flash = { n: hit.n, col: '#2e7d32' }; $('#mmsg').innerHTML = `<b>📍 ${esc(hit.n)}</b><br>${esc(hit.t)} <span class="muted">(${esc(hit.r)})</span>`; round++; if (round >= order.length) return win(); next(); ask(); setTimeout(() => { flash = null; }, 700); }
    else { funSnd('crash'); if (youth) tm = Math.max(0, tm - 5); flash = { n: hit.n, col: '#ef6c00' }; $('#mmsg').innerHTML = `<span class="bad">That is ${esc(hit.n)}. Look for <b>${esc(target.n)}</b>.${youth ? ' −5 seconds' : ''}</span>`; setTimeout(() => { flash = null; }, 500); }
  };
  $('#ml').onclick = () => { yaw -= .4; }; $('#mr').onclick = () => { yaw += .4; }; $('#mt').onclick = () => { tilt = tilt > .7 ? .4 : 1; }; $('#mz').onclick = () => { V = V.k > 1 ? { lon: 35.1, lat: 32.1, k: 1 } : { lon: 35.15, lat: 31.8, k: 2.3 }; };
  if (youth) clock = setInterval(() => { if (!cv.isConnected || G !== window.__funGen) return clearInterval(clock); if (over) return; tm--; const el = $('#mt2'); if (el) el.textContent = Math.max(0, tm); if (tm <= 0) { over = true; clearInterval(clock); $('#mq').innerHTML = `<b class="bad">⏰ Time is up!</b> You found ${score} of ${order.length}. <button class="btn small" id="mre">Try again</button>`; $('#mre').onclick = () => { stop(); funMap(area, g); }; funSnd('crash'); } }, 1000);
  next(); ask(); draw();
}
const PLANETS = [
  { n: 'Mercury', c: '#b0a79b', r: 5, t: 'Mercury is the closest planet to the Sun.' }, { n: 'Venus', c: '#e8c27a', r: 8, t: 'Venus is the hottest planet.' },
  { n: 'Earth', c: '#3d8fd6', r: 8.5, t: 'Earth is our home. “In the beginning God created the heavens and the earth.” (Genesis 1:1)' }, { n: 'Mars', c: '#c8553d', r: 6.5, t: 'Mars is called the red planet.' },
  { n: 'Jupiter', c: '#d9a066', r: 17, t: 'Jupiter is the biggest planet of all.' }, { n: 'Saturn', c: '#e3cf95', r: 14, t: 'Saturn has bright rings around it.' },
  { n: 'Uranus', c: '#8fd8e0', r: 10, t: 'Uranus is tipped over on its side.' }, { n: 'Neptune', c: '#3f5fd0', r: 10, t: 'Neptune is the farthest planet from the Sun.' }];
function funPlanets(area, g) {
  const G = window.__funGen, Wd = 340, H = 380, youth = g === 'youth'; let yaw = 0, tilt = .5, drag = null, moved = false, round = 0, score = 0, target, order = PLANETS.slice().sort(() => Math.random() - .5).slice(0, youth ? 8 : 5), mode = 'find', t0 = 0;
  const q = () => youth && round % 2 ? { text: `Which planet is number <b>${PLANETS.indexOf(target) + 1}</b> from the Sun?` } : { text: `Find <b>${esc(target.n)}</b>!` };
  area.innerHTML = `<p id="pq"></p><canvas id="pc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;touch-action:none;display:block;margin:auto;background:#070b1f"></canvas><div id="pmsg" class="card" style="min-height:48px;margin-top:8px">Drag to turn the solar system around. God made the sun, moon and stars (Genesis 1:16).</div>`;
  const cv = $('#pc'), cx = cv.getContext('2d'), stars = Array.from({ length: 70 }, () => [Math.random() * Wd, Math.random() * H, Math.random() * 1.5 + .3]);
  const next = () => { target = order[round]; $('#pq').innerHTML = `${q().text}  Found: <b>${score}</b> of ${order.length}`; }; next();
  const pos = (p, i, t) => { const a = t * (1.2 / (i + 1.5)) + i * 1.3, d = 38 + i * 19, x = Math.cos(a) * d, z = Math.sin(a) * d, c = Math.cos(yaw), s = Math.sin(yaw), rx = x * c - z * s, rz = x * s + z * c; return { sx: Wd / 2 + rx, sy: H / 2 + rz * tilt, sc: 1 + rz / 400, z: rz, d }; };
  const loop = () => {
    if (!cv.isConnected || G !== window.__funGen) return; t0 += .012; cx.fillStyle = '#070b1f'; cx.fillRect(0, 0, Wd, H); cx.fillStyle = '#fff'; stars.forEach(([x, y, r]) => { cx.globalAlpha = .6; cx.fillRect(x, y, r, r); }); cx.globalAlpha = 1;
    PLANETS.forEach((p, i) => { cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.beginPath(); cx.ellipse(Wd / 2, H / 2, 38 + i * 19, (38 + i * 19) * tilt, 0, 0, 6.283); cx.stroke(); });
    const items = PLANETS.map((p, i) => ({ p, i, o: pos(p, i, t0) })).concat([{ sun: 1, o: { sx: Wd / 2, sy: H / 2, sc: 1, z: 0 } }]).sort((a, b) => a.o.z - b.o.z);
    items.forEach(({ p, o, sun }) => { if (sun) { const gr = cx.createRadialGradient(o.sx, o.sy, 2, o.sx, o.sy, 26); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(.5, '#ffb300'); gr.addColorStop(1, 'rgba(255,140,0,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(o.sx, o.sy, 26, 0, 6.283); cx.fill(); return; }
      const r = p.r * .8 * o.sc, gr = cx.createRadialGradient(o.sx - r * .3, o.sy - r * .3, r * .1, o.sx, o.sy, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, p.c); gr.addColorStop(1, shade(p.c, .35)); cx.fillStyle = gr; cx.beginPath(); cx.arc(o.sx, o.sy, r, 0, 6.283); cx.fill();
      if (p.n === 'Saturn') { cx.strokeStyle = 'rgba(230,210,150,.85)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(o.sx, o.sy, r * 1.8, r * .55, -.3, 0, 6.283); cx.stroke(); } p._o = { x: o.sx, y: o.sy, r }; });
    window.__funRaf = requestAnimationFrame(loop);
  };
  cv.onpointerdown = e => { drag = [e.clientX, e.clientY]; moved = false; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; yaw += dx * .01; tilt = Math.max(.25, Math.min(1, tilt + dy * .004)); drag = [e.clientX, e.clientY]; };
  cv.onpointerup = e => {
    const tap = drag && !moved; drag = null; if (!tap || round >= order.length) return; const b = cv.getBoundingClientRect(), mx = (e.clientX - b.left) * Wd / b.width, my = (e.clientY - b.top) * H / b.height;
    const hit = PLANETS.filter(p => p._o && Math.hypot(p._o.x - mx, p._o.y - my) < Math.max(18, p._o.r + 8)).sort((a, c) => Math.hypot(a._o.x - mx, a._o.y - my) - Math.hypot(c._o.x - mx, c._o.y - my))[0]; if (!hit) return;
    if (hit === target) { score++; round++; funSnd('coin'); funBuzz(15); $('#pmsg').innerHTML = `<b>🪐 ${esc(hit.n)}</b><br>${esc(hit.t)}`; if (round >= order.length) { funWin(area); $('#pq').innerHTML = `<b class="good">🎉 You found every planet!</b> <button class="btn small" id="pre">Play again</button>`; $('#pre').onclick = () => { if (window.__funRaf) cancelAnimationFrame(window.__funRaf); funPlanets(area, g); }; } else next(); }
    else { funSnd('crash'); $('#pmsg').innerHTML = `<span class="bad">That is ${esc(hit.n)}. Try to find <b>${esc(target.n)}</b>.</span>`; }
  };
  loop();
}
function funMath(area, g) {
  const G = window.__funGen, youth = g === 'youth', Wd = 300, H = 330, GOAL = youth ? 12 : 8; let h = 0, q, streak = 0, miss = 0, yaw = .6;
  area.innerHTML = `<p>Answer to add a block to your tower. Reach <b>${GOAL}</b> blocks! A wrong answer knocks one off.</p><canvas id="tc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;display:block;margin:auto;background:linear-gradient(#cfe9ff,#f2f9ff)"></canvas><div class="card gold" style="margin-top:8px"><p class="bigword" id="tq"></p><div id="to"></div><div id="tm" style="min-height:24px"></div></div>`;
  const cv = $('#tc'), cx = cv.getContext('2d'), draw = () => { cx.clearRect(0, 0, Wd, H); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) drawCube(cx, x, y, 0, '#8bc34a', yaw, 26, Wd / 2, 270, 1.5, 0); for (let k = 0; k < h; k++) drawCube(cx, 1, 1, k, BRICKCOL[k % BRICKCOL.length], yaw, 26, Wd / 2, 270, 1.5); };
  const make = () => { const r = n => Math.floor(Math.random() * n); let a, b, ans, txt;
    if (!youth) { a = 2 + r(9); b = 2 + r(9 - 0); if (r(2)) { ans = a + b; txt = `${a} + ${b}`; } else { if (b > a) [a, b] = [b, a]; ans = a - b; txt = `${a} − ${b}`; } }
    else { const k = r(3); if (k === 0) { a = 3 + r(10); b = 3 + r(10); ans = a * b; txt = `${a} × ${b}`; } else if (k === 1) { a = 20 + r(70); b = 11 + r(40); ans = a + b; txt = `${a} + ${b}`; } else { b = 3 + r(9); ans = 3 + r(12); a = b * ans; txt = `${a} ÷ ${b}`; } }
    const set = new Set([ans]); while (set.size < 4) { const d = ans + (r(2) ? 1 : -1) * (1 + r(youth ? 12 : 5)); if (d >= 0) set.add(d); } q = { txt, ans, opts: [...set].sort(() => Math.random() - .5) }; };
  const show = () => { make(); $('#tq').textContent = q.txt + ' = ?'; $('#to').innerHTML = q.opts.map(o => `<button class="btn ghost" data-a="${o}" style="min-width:64px;margin:4px">${o}</button>`).join(''); $('#to').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (h >= GOAL) return; if (+b.dataset.a === q.ans) { h++; streak++; funSnd(streak % 3 === 0 ? 'level' : 'coin'); $('#tm').innerHTML = '<span class="good">Yes! ⬆ A block goes on.</span>'; draw(); if (h >= GOAL) { funWin(area); $('#tm').innerHTML = '<b class="good">🎉 Your tower is finished!</b> <button class="btn small" id="tre">Build another</button>'; $('#tre').onclick = () => funMath(area, g); return; } show(); } else { streak = 0; if (h > 0) h--; funSnd('crash'); $('#tm').innerHTML = `<span class="bad">Not quite. It was ${q.ans}.${h >= 0 ? ' A block fell off.' : ''}</span>`; draw(); show(); } }); };
  draw(); show();
}
const CDAYS = [
  { d: 1, e: '💡', n: 'Light', t: 'God made light and separated it from the darkness.', r: 'Genesis 1:3-5' },
  { d: 2, e: '☁️', n: 'Sky', t: 'God made the sky between the waters.', r: 'Genesis 1:6-8' },
  { d: 3, e: '🌱', n: 'Land and plants', t: 'God gathered the waters, made dry land and plants and trees.', r: 'Genesis 1:9-13' },
  { d: 4, e: '🌙', n: 'Sun, moon and stars', t: 'God made the sun, moon and stars.', r: 'Genesis 1:14-19' },
  { d: 5, e: '🐟', n: 'Fish and birds', t: 'God filled the waters with fish and the sky with birds.', r: 'Genesis 1:20-23' },
  { d: 6, e: '🦁', n: 'Animals and people', t: 'God made the animals and then people in His own image.', r: 'Genesis 1:24-31' },
  { d: 7, e: '😌', n: 'Rest', t: 'God finished His work and rested on the seventh day.', r: 'Genesis 2:2-3' }];
function funCreation(area, g) {
  const G = window.__funGen, youth = g === 'youth', Wd = 300, H = 330; let built = [], q, order = youth ? CDAYS.slice().sort(() => Math.random() - .5) : CDAYS.slice(), idx = 0, lives = youth ? 3 : 99, yaw = .6;
  area.innerHTML = `<p>${youth ? 'On which day did God make each thing? You have 3 tries to spare.' : 'Build the tower of creation. What did God make on each day?'}</p><canvas id="kc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;display:block;margin:auto;background:linear-gradient(#cfe9ff,#f2f9ff)"></canvas><div class="card gold" style="margin-top:8px"><p class="bigword" id="kq"></p><div id="ko"></div><div id="km" style="min-height:24px"></div></div>`;
  const cv = $('#kc'), cx = cv.getContext('2d'), cols = ['#fdd835', '#64b5f6', '#66bb6a', '#ffb74d', '#4dd0e1', '#ef6c00', '#ba68c8'];
  const draw = () => { cx.clearRect(0, 0, Wd, H); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) drawCube(cx, x, y, 0, '#8bc34a', yaw, 26, Wd / 2, 285, 1.5, 0); built.slice().sort((a, b) => a - b).forEach((d, k) => { drawCube(cx, 1, 1, k, cols[d - 1], yaw, 26, Wd / 2, 285, 1.5); }); cx.font = '22px serif'; cx.textAlign = 'center'; built.slice().sort((a, b) => a - b).forEach((d, k) => { const c = Math.cos(yaw), s = Math.sin(yaw), dx = 0, rx = dx, sx = Wd / 2, sy = 285 + 0 * 0 - (k + .5) * 26 * .95 + 1.5 * 0; cx.fillText(CDAYS[d - 1].e, sx, sy + 10 - 0); }); };
  const show = () => { if (idx >= order.length) return; q = order[idx]; const opts = youth ? CDAYS.map(x => ({ v: x.d, l: 'Day ' + x.d })) : CDAYS.map(x => ({ v: x.d, l: x.e + ' ' + x.n })).sort(() => Math.random() - .5).filter((o, i, a) => true);
    $('#kq').textContent = youth ? `${q.e} ${q.n}: which day?` : `Day ${q.d}: what did God make?`; const shown = youth ? opts : (() => { const o = [q.d, ...CDAYS.filter(x => x.d !== q.d).sort(() => Math.random() - .5).slice(0, 3).map(x => x.d)].sort(() => Math.random() - .5); return o.map(v => ({ v, l: CDAYS[v - 1].e + ' ' + CDAYS[v - 1].n })); })();
    $('#ko').innerHTML = shown.map(o => `<button class="btn ghost" data-a="${o.v}" style="margin:3px">${esc(o.l)}</button>`).join('');
    $('#ko').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (idx >= order.length || lives <= 0) return; if (+b.dataset.a === q.d) { built.push(q.d); idx++; funSnd('coin'); funBuzz(15); $('#km').innerHTML = `<span class="good"><b>${q.e} Day ${q.d}</b> ${esc(q.t)} (${esc(q.r)})</span>`; draw(); if (idx >= order.length) { funWin(area); $('#kq').textContent = '🎉 Creation is complete!'; $('#ko').innerHTML = '<button class="btn small" id="kre">Build again</button>'; $('#kre').onclick = () => funCreation(area, g); return; } show(); } else { funSnd('crash'); if (youth) { lives--; if (lives <= 0) { $('#km').innerHTML = '<span class="bad">Out of tries. <button class="btn small" id="kre">Try again</button></span>'; $('#kre').onclick = () => funCreation(area, g); return; } } $('#km').innerHTML = `<span class="bad">Not that one. Think about Genesis 1.${youth ? ' Tries left: ' + lives : ''}</span>`; } }); };
  draw(); show();
}
const TAB = [
  { e: '🔥', n: 'Bronze altar', z: 0, t: 'The bronze altar stood in the courtyard, where sacrifices were offered.', r: 'Exodus 27:1-2' },
  { e: '🏺', n: 'Bronze basin', z: 0, t: 'The priests washed at the basin in the courtyard.', r: 'Exodus 30:18-19' },
  { e: '🕯️', n: 'Golden lampstand', z: 1, t: 'The golden lampstand gave light in the Holy Place.', r: 'Exodus 25:31' },
  { e: '🍞', n: 'Table of bread', z: 1, t: 'Bread was set on the table in the Holy Place.', r: 'Exodus 25:23-30' },
  { e: '💨', n: 'Altar of incense', z: 1, t: 'Incense was burned on the golden altar in the Holy Place.', r: 'Exodus 30:1' },
  { e: '📦', n: 'Ark of the Covenant', z: 2, t: 'The ark was placed in the Most Holy Place.', r: 'Exodus 26:33' }];
const TZONES = ['Courtyard', 'Holy Place', 'Most Holy Place'];
function funTabernacle(area, g) {
  const G = window.__funGen, youth = g === 'youth', Wd = 320, H = 280; let placed = [], sel = null, yaw = .7, wrong = 0; const items = TAB.slice().sort(() => Math.random() - .5);
  area.innerHTML = `<p>Build God’s tent (the Tabernacle). Tap a piece, then tap the place where it belongs.</p><canvas id="tbc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;display:block;margin:auto;background:linear-gradient(#d9ecff,#f7fbff)"></canvas><div class="bubs" id="tbi" style="margin-top:8px"></div><div class="seg" id="tbz"></div><div id="tbm" class="card" style="min-height:44px;margin-top:6px"></div>`;
  const cv = $('#tbc'), cx = cv.getContext('2d'), zc = ['#d7c29a', '#e6c76a', '#b5a0e0'], zx = [[0, 0, 3, 3], [3, 0, 2, 3], [5, 0, 1, 3]];
  const draw = () => { cx.clearRect(0, 0, Wd, H); zx.forEach(([x, y, w, h], zi) => { for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) drawCube(cx, x + a, y + b, 0, zc[zi], yaw, 22, Wd / 2, 130, 3, 0); }); placed.forEach(it => { const z = zx[it.z], c = Math.cos(yaw), s = Math.sin(yaw), n = placed.filter(p => p.z === it.z).indexOf(it), cxp = z[0] + (n % z[2]), cyp = z[1] + Math.floor(n / z[2]) % 3; drawCube(cx, cxp, cyp + (it.z === 0 ? 0 : 0), 0, ['#8d6e63', '#ffb300', '#7e57c2'][it.z], yaw, 22, Wd / 2, 130, 3, .8); const dx = cxp + .5 - 3, dy = cyp + .5 - 3, rx = dx * c - dy * s, ry = dx * s + dy * c; cx.font = '20px serif'; cx.textAlign = 'center'; cx.fillText(it.e, Wd / 2 + (rx - ry) * 22 * .866, 130 + (rx + ry) * 22 * .5 - 28); }); };
  const list = () => { $('#tbi').innerHTML = items.filter(i => !placed.includes(i)).map(i => `<button class="bub ${sel === i ? 'on' : ''}" data-i="${items.indexOf(i)}"><span class="bi">${i.e}</span><span class="bn">${esc(i.n)}</span></button>`).join(''); $('#tbi').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { sel = items[+b.dataset.i]; list(); }); };
  $('#tbz').innerHTML = TZONES.map((z, i) => `<button class="btn small ghost" data-z="${i}">${z}</button>`).join(''); $('#tbz').style.flexWrap = 'wrap';
  $('#tbz').querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
    if (!sel) { $('#tbm').textContent = 'First tap a piece above.'; return; }
    if (sel.z === +b.dataset.z) { placed.push(sel); funSnd('coin'); funBuzz(15); $('#tbm').innerHTML = `<b>${sel.e} ${esc(sel.n)}</b><br>${esc(sel.t)} <span class="muted">(${esc(sel.r)})</span>`; sel = null; list(); draw(); if (placed.length === items.length) { funWin(area); $('#tbm').innerHTML += `<br><br><b class="good">🎉 The Tabernacle is built!</b> <button class="btn small" id="tbre">Build again</button>`; $('#tbre').onclick = () => funTabernacle(area, g); } }
    else { wrong++; funSnd('crash'); $('#tbm').innerHTML = `<span class="bad">${esc(sel.n)} does not go in the ${TZONES[+b.dataset.z]}. Try another place.</span>`; }
  });
  list(); draw();
}
const TLINE = [
  { n: 'God creates the world', r: 'Genesis 1' }, { n: 'Noah and the flood', r: 'Genesis 7' }, { n: 'God calls Abraham', r: 'Genesis 12' }, { n: 'Joseph rules in Egypt', r: 'Genesis 41' },
  { n: 'Moses and the Exodus', r: 'Exodus 14' }, { n: 'Walls of Jericho fall', r: 'Joshua 6' }, { n: 'David becomes king', r: '2 Samuel 5' }, { n: 'Solomon builds the temple', r: '1 Kings 6' },
  { n: 'Daniel in the lions’ den', r: 'Daniel 6' }, { n: 'Jesus is born', r: 'Luke 2' }, { n: 'Jesus rises from the dead', r: 'Luke 24' }, { n: 'The Holy Spirit comes at Pentecost', r: 'Acts 2' }];
function funTimeline(area, g) {
  const youth = g === 'youth', G = window.__funGen, Wd = 300, H = 330, evs = youth ? TLINE.slice() : [TLINE[0], TLINE[1], TLINE[4], TLINE[6], TLINE[9], TLINE[10]]; let n = 0, yaw = .6, miss = 0; const bank = evs.map((e, i) => i).sort(() => Math.random() - .5);
  area.innerHTML = `<p>Tap the events in the order they happened in the Bible. Each right one adds a block to the tower!</p><canvas id="lc" width="${Wd}" height="${H}" style="width:100%;max-width:${Wd}px;border-radius:14px;display:block;margin:auto;background:linear-gradient(#cfe9ff,#f2f9ff)"></canvas><div class="card"><div id="lb"></div><div id="lm" style="min-height:24px;margin-top:6px"></div></div>`;
  const cv = $('#lc'), cx = cv.getContext('2d'), draw = () => { cx.clearRect(0, 0, Wd, H); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) drawCube(cx, x, y, 0, '#8bc34a', yaw, 24, Wd / 2, 300, 1.5, 0); for (let k = 0; k < n; k++) drawCube(cx, 1, 1, k, BRICKCOL[k % BRICKCOL.length], yaw, 24, Wd / 2, 300, 1.5); };
  const list = () => { $('#lb').innerHTML = bank.filter(i => i >= n || true).filter(i => i >= n).map(i => `<button class="btn ghost" data-e="${i}" style="display:block;width:100%;margin:4px 0;text-align:left">${esc(evs[i].n)}</button>`).join(''); $('#lb').querySelectorAll('[data-e]').forEach(b => b.onclick = () => { const i = +b.dataset.e; if (i === n) { n++; funSnd('coin'); funBuzz(15); $('#lm').innerHTML = `<span class="good"><b>${esc(evs[i].n)}</b> (${esc(evs[i].r)})</span>`; draw(); if (n >= evs.length) { funWin(area); $('#lb').innerHTML = '<b class="good">🎉 The whole timeline is in order!</b> <button class="btn small" id="lre">Play again</button>'; $('#lre').onclick = () => funTimeline(area, g); } else list(); } else { miss++; funSnd('crash'); $('#lm').innerHTML = '<span class="bad">That one comes later or came before. Think again.</span>'; } }); };
  draw(); list();
}
const STUDIO = [['bricks', '🧱', 'Brick Builder', funBricks], ['map', '🗺️', 'Holy Land Map', funMap], ['planets', '🪐', 'Planet Explorer', funPlanets], ['math', '🧮', 'Math Tower', funMath], ['creation', '🌈', 'Creation Tower', funCreation], ['tab', '⛺', 'Build the Tabernacle', funTabernacle], ['line', '📜', 'Bible Timeline', funTimeline]];
function funStudio(area, g, pick) {
  window.__funGen = (window.__funGen || 0) + 1; if (window.__funRaf) { cancelAnimationFrame(window.__funRaf); window.__funRaf = 0; }
  area.innerHTML = `<div class="bubs">${STUDIO.map(([k, em, n]) => `<button class="bub ${pick === k ? 'on' : ''}" data-st="${k}"><span class="bi">${em}</span><span class="bn">${n}</span></button>`).join('')}</div><div id="stg">${pick ? '' : '<p class="muted">Pick a 3D game: build with bricks, find places on a map of the Holy Land, explore the planets, or stack a math tower. 🧰</p>'}</div>`;
  area.querySelectorAll('[data-st]').forEach(b => b.onclick = () => funStudio(area, g, b.dataset.st));
  if (pick) { window.__funGen++; const gg = window.__funGen; STUDIO.find(x => x[0] === pick)[3]($('#stg'), g); }
}
/* ---------- Simon Pattern: each colour plays a note ---------- */
function funSimon(area, g) {
  const hard = g === 'youth', cols = ['#e53935', '#43a047', '#1e88e5', '#fdd835'], snd = ['c', 'd', 'e', 'f'], seq = [], G = window.__funGen, alive = () => area.isConnected && G === window.__funGen; let pos = 0, busy = true, best = funBest('simon', g);
  const flash = (i, ms) => { const b = area.querySelector(`[data-p="${i}"]`); if (!b) return; funSnd(snd[i]); b.style.opacity = '1'; b.style.transform = 'scale(1.06)'; b.style.outline = '4px solid #fff'; setTimeout(() => { if (b.isConnected) { b.style.opacity = '.55'; b.style.transform = ''; b.style.outline = ''; } }, ms); };
  const draw = m => { area.innerHTML = `<p>Watch, listen, then repeat the pattern. Round: <b>${seq.length}</b> · 🏆 Best <b>${best}</b></p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:240px">${cols.map((c, i) => `<button data-p="${i}" aria-label="colour ${i + 1}" style="height:90px;border:0;border-radius:12px;background:${c};opacity:.55;transition:transform .1s"></button>`).join('')}</div><p>${m || ''}</p>`; area.querySelectorAll('[data-p]').forEach(b => b.onclick = () => press(+b.dataset.p)); };
  const play = () => { busy = true; pos = 0; seq.push(Math.floor(Math.random() * 4)); draw('Watch…'); const gap = hard ? 380 : 600; seq.forEach((c, k) => setTimeout(() => { if (alive()) flash(c, gap - 150); }, 700 + k * gap)); setTimeout(() => { if (alive()) { busy = false; draw('Your turn! 👆'); } }, 700 + seq.length * gap); };
  const press = i => {
    if (busy) return; flash(i, 200);
    if (i !== seq[pos]) { busy = true; funSnd('crash'); funBuzz(120); const n = seq.length - 1; if (funSetBest('simon', g, n)) { best = n; funWin(area); } seq.length = 0; draw(`<b>Oops! You got ${n} round${n === 1 ? '' : 's'}.</b> <button class="btn small" id="sa">Play again</button>`); $('#sa').onclick = play; return; }
    if (++pos === seq.length) { busy = true; best = Math.max(best, seq.length); funSetBest('simon', g, seq.length); setTimeout(() => { if (alive()) { funSnd('ok'); play(); } }, 700); }
  };
  draw('<button class="btn" id="sa">▶ Start</button>'); $('#sa').onclick = play;
}


/* ---------- Ask Pastor Santosh: prepared answers, voice, passages and a word concordance (World English Bible) ---------- */
let ASK = { items: [] }, WEBB = null;
const ASK_STOP = new Set('a an the of to and or in on is it i me my am are be do does what how can for with that this you your we'.split());
const askTok = t => String(t).toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !ASK_STOP.has(w)).map(w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w) || [];
function askSearch(q) {
  const qs = askTok(q); if (!qs.length) return [];
  return (ASK.items || []).map(it => {
    const head = new Set(askTok(it.q + ' ' + it.cat)), body = new Set(askTok(it.a.join(' ')));
    let sc = 0; qs.forEach(w => { if (head.has(w)) sc += 3; else if (body.has(w)) sc += 1; });
    return [sc, it];
  }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
}
const askSpeakLang = () => LANG === 'ne' ? 'ne-NP' : 'en-US';
function askShow(it) {
  return `<div class="card gold"><h2>${esc(it.q)}</h2>${it.a.map(p => `<p>${esc(p).replace(/\*([^*]+)\*/g, '<i>$1</i>')}</p>`).join('')}${it.src && it.src.length ? `<p class="muted"><span>Go deeper:</span> ${it.src.map(esc).join(' · ')}</p>` : ''}<button type="button" class="btn small ghost asklisten" data-i="${it.id}"><span>🔊</span> <span>Listen</span></button></div>`;
}
async function askLoadBible() {
  if (WEBB) return WEBB;
  const j = await getJson('data/bible-web.json'); WEBB = j && j.b ? j.b : null; return WEBB;
}
/* "John 3:16", "Psalm 23", "1 Cor 13:4-7" -> { b, c, v1, v2 } */
function askParseRef(q) {
  const m = String(q).trim().match(/^(\d?\s*[A-Za-z][A-Za-z .]*?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) return null;
  const b = bookIdx(m[1]); if (b < 0) return null;
  return { b, c: +m[2], v1: m[3] ? +m[3] : 0, v2: m[4] ? +m[4] : (m[3] ? +m[3] : 0) };
}
async function askPassage(r) {
  const B = await askLoadBible(); if (!B) return '<div class="card">The Bible text could not load. Check your connection and try again.</div>';
  const ch = B[r.b] && B[r.b][r.c - 1]; if (!ch) return '<div class="card">I could not find that chapter.</div>';
  const a = r.v1 || 1, z = r.v1 ? Math.min(r.v2, ch.length) : ch.length;
  if (a > ch.length) return '<div class="card">I could not find that verse.</div>';
  const ref = BOOKS[r.b] + ' ' + r.c + (r.v1 ? ':' + a + (z > a ? '-' + z : '') : '');
  const body = ch.slice(a - 1, z).map((t, k) => `<p><sup>${a + k}</sup> ${esc(t)}</p>`).join('');
  const nasb = (CFG.versions || []).find(v => v.id === 'NASB1995');
  const link = nasb && nasb.type === 'youversion' ? `<p>${linkBtn(yvUrl(ref, nasb), 'Read in NASB 1995')}</p>` : '';
  return `<div class="card gold"><h2>${esc(ref)}</h2>${body}<p class="muted">World English Bible (public domain).</p>${link}<button type="button" class="btn small ghost askspeak" data-t="${esc(ch.slice(a - 1, z).join(' '))}"><span>🔊</span> <span>Listen</span></button></div>`;
}
async function askConcordance(q, limit) {
  const B = await askLoadBible(); if (!B) return '<div class="card">The Bible text could not load. Check your connection and try again.</div>';
  const words = (String(q).toLowerCase().match(/[a-z']+/g) || []).filter(w => w.length > 1);
  if (!words.length) return '';
  const res = [], per = {};
  B.forEach((chs, bi) => chs.forEach((vs, ci) => vs.forEach((t, vi) => {
    const low = ' ' + t.toLowerCase().replace(/[^a-z' ]+/g, ' ') + ' ';
    if (words.every(w => low.includes(' ' + w + ' ') || low.includes(' ' + w + 's ') || low.includes(' ' + w + 'ed ') || low.includes(' ' + w + 'ing ') || low.includes(' ' + w + 'es '))) { res.push([bi, ci, vi, t]); per[bi] = (per[bi] || 0) + 1; }
  })));
  const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b, n]) => `${esc(BOOKS[b])} ${n}`).join(', ');
  const shown = res.slice(0, limit);
  const rows = shown.map(([b, c, v, t]) => `<div class="askverse"><b>${esc(BOOKS[b])} ${c + 1}:${v + 1}</b> ${esc(t)}</div>`).join('');
  return `<div class="card"><h2>"${esc(words.join(' '))}" in the Bible</h2><p class="muted">${res.length} verse${res.length === 1 ? '' : 's'} (World English Bible).${top ? ' Most in: ' + top + '.' : ''}</p>${rows}${res.length > limit ? `<button type="button" class="btn small" id="askmore" data-n="${limit + 40}">Show more</button>` : ''}</div>`;
}

let STR = null, STRC = {};
async function askLoadStrongs() { if (STR) return STR; const j = await getJson('data/strongs.json'); STR = j && j.e ? j.e : null; STRC = (j && j.c) || {}; return STR; }
function strongsRow(id, e) {
  const gr = id[0] === 'G';
  return `<div class="askverse"><b>${esc(id)}</b> <span lang="${gr ? 'el' : 'he'}" data-keep>${esc(e[0])}</span> <i>${esc(e[1])}</i> <span class="muted">(${gr ? 'Greek' : 'Hebrew'})</span><br>${esc(e[2])}${e[3] ? `<br><span class="muted">Translated in the KJV as: ${esc(e[3])}</span>` : ''}</div>`;
}
async function askWordStudy(q) {
  const D = await askLoadStrongs(); if (!D) return '';
  const m = String(q).trim().match(/^([GgHh])\s*0*(\d{1,4})$/);
  if (m) { const id = m[1].toUpperCase() + m[2], e = D[id]; return e ? `<div class="card"><h2>Strong's ${esc(id)}</h2>${strongsRow(id, e)}</div>` : ''; }
  const w = (String(q).toLowerCase().match(/[a-z']+/g) || []);
  if (w.length !== 1 || w[0].length < 3) return '';
  const word = w[0], hits = [];
  for (const [id, e] of Object.entries(D)) {
    const toks = e[3].toLowerCase().replace(/[()\[\]]/g, ' ').split(/[,;\s-]+/).filter(Boolean);
    const at = toks.findIndex(t => t === word || t === word + 's' || t === word + 'ed' || t === word + 'ing');
    if (at < 0) continue;
    const first = at === 0 ? 0 : 1;
    hits.push([first * 100 + at + e[3].length / 20, id, e]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  const cur = (STRC[word] || '').split(' ').filter(id => D[id]);
  const top = cur.map(id => [0, id, D[id]]).concat(hits.filter(h => !cur.includes(h[1]))).slice(0, 6);
  if (!top.length) return '';
  return `<div class="card"><h2>Original words behind "${esc(word)}"</h2><p class="muted">Strong's dictionary lists these Greek and Hebrew words that the King James Version translated with this word. A different Bible version may use other words. This is a starting point for study, so read the verse in its context.</p>${top.map(([, id, e]) => strongsRow(id, e)).join('')}<p class="muted">Source: ${esc("James Strong's dictionary (1890), data from Open Scriptures, CC-BY-SA.")}</p></div>`;
}
function askSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = askSpeakLang(); u.rate = 0.95; speechSynthesis.speak(u);
}
function askOpen() {
  let p = $('#askpanel'); if (p) { p.hidden = false; $('#askq').focus(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  p = document.createElement('div'); p.id = 'askpanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Ask Pastor Santosh');
  p.innerHTML = `<div class="askbox"><div class="askhead"><b>Ask Pastor Santosh</b><button class="btn small ghost" id="askx" aria-label="Close">Close</button></div>
    <p class="muted">Type or speak a question. You will see the closest prepared answer. This is not a live chat, and it does not replace talking with a pastor.</p>
    <p class="muted">To read a passage, type it, for example John 3:16. To find where a word appears in the Bible, and the Greek or Hebrew word behind it, type the word, for example grace. You can also type a Strong's number, for example G26.</p>
    <p class="muted">Answers are in English for now. Nepali answers will come after a Nepali reader checks them.</p><div class="askrow"><input id="askq" type="search" placeholder="Type your question" autocomplete="off">${SR ? '<button type="button" class="btn small" id="askmic" aria-label="Speak"><span>🎤</span> <span>Speak</span></button>' : ''}</div>
    <div id="askres"></div></div>`;
  document.body.appendChild(p);
  let limit = 40, lastQ = '';
  const run = async () => {
    const v = $('#askq').value.trim(); lastQ = v; limit = 40;
    if (!v) { $('#askres').innerHTML = ''; return; }
    const ref = askParseRef(v);
    if (ref) { $('#askres').innerHTML = await askPassage(ref); return; }
    if (/^[GgHh]\s*\d{1,4}$/.test(v)) { $('#askres').innerHTML = await askWordStudy(v); return; }
    const r = askSearch(v);
    let html = r.length ? r.map(askShow).join('') : '<div class="card">I do not have a prepared answer for that yet. Please talk with Pastor Santosh or one of the church leaders. If you are in danger or thinking of harming yourself, call or text 988 in the US, or call 911. Outside the US, contact your local emergency service and a trusted pastor.</div>';
    html += `<p><button type="button" class="btn small ghost" id="askfind"><span>📖</span> <span>Find these words in the Bible</span></button></p><div id="askconc"></div>`;
    $('#askres').innerHTML = html; applyLang();
  };
  let tm; $('#askq').oninput = () => { clearTimeout(tm); tm = setTimeout(run, 250); };
  $('#askq').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(tm); run(); } };
  $('#askres').onclick = async e => {
    const lb = e.target.closest('.asklisten'); if (lb) { const it = (ASK.items || []).find(x => String(x.id) === lb.dataset.i); if (it) askSpeak(it.q + '. ' + it.a.join(' ')); return; }
    const sp = e.target.closest('.askspeak'); if (sp) { askSpeak(sp.dataset.t); return; }
    if (e.target.closest('#askfind')) { $('#askconc').innerHTML = '<p class="muted">Searching…</p>'; $('#askconc').innerHTML = (await askWordStudy(lastQ)) + (await askConcordance(lastQ, limit)); applyLang(); return; }
    const mb = e.target.closest('#askmore'); if (mb) { limit = +mb.dataset.n; $('#askconc').innerHTML = await askConcordance(lastQ, limit); }
  };
  if (SR) {
    const mic = $('#askmic'); let rec = null, on = false;
    mic.onclick = () => {
      if (on && rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = askSpeakLang(); rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => { on = true; mic.classList.add('live'); };
      rec.onend = () => { on = false; mic.classList.remove('live'); };
      rec.onerror = () => { on = false; mic.classList.remove('live'); };
      rec.onresult = ev => { $('#askq').value = ev.results[0][0].transcript; run(); };
      try { rec.start(); } catch (e) {}
    };
  }
  $('#askx').onclick = () => { p.hidden = true; if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') p.hidden = true; });
  applyLang(); $('#askq').focus();
}
(function askButton() {
  const b = document.createElement('button'); b.id = 'askfab'; b.type = 'button'; b.innerHTML = '<span>💬</span> <span>Ask Pastor Santosh</span>'; b.hidden = true; b.onclick = askOpen;
  document.body.appendChild(b);
  const t = setInterval(() => { const app = $('#app'); if (app && !app.hidden) { b.hidden = false; clearInterval(t); } }, 500);
})();
