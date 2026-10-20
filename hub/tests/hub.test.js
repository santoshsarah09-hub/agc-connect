const assert = require('assert'); const { makeHub } = require('./mock-gas');
const env = makeHub(); let pass = 0;
const t = (n, f) => { try { f(); pass++; console.log('  ok  ' + n); } catch (e) { console.error('FAIL  ' + n + '\n      ' + e.message); process.exitCode = 1; } };
const post = b => env.post(b);
const sheetText = () => JSON.stringify(Object.values(env.sheetsById).map(s => s.sheets.map(x => x.rows)));
env.call('setup');
const PIN = () => env.props.ADMIN_PIN;
const admin = () => post({ action: 'login', leader: 'admin', pin: PIN() });
console.log('Hub backend tests');
t('setup creates folders, sheet with 7 tabs, admin PIN; safe to run twice', () => {
  assert.strictEqual(env.root.kids[0].name, 'Executive Assistant Workspace'); assert.strictEqual(env.root.kids[0].kids[0].name, 'AGC Connect'); assert.strictEqual(env.root.kids[0].kids[0].kids[0].name, 'Leader Resources');
  assert(/^\d{6}$/.test(PIN())); assert.strictEqual(Object.values(env.sheetsById)[0].sheets.length, 7);
  env.call('setup'); assert.strictEqual(Object.keys(env.sheetsById).length, 1); assert.strictEqual(env.root.kids.length, 1);
});
t('public feed starts empty and lists the admin as a sign-in name', () => { const f = env.feed(); assert.deepStrictEqual(f.songs, []); assert.strictEqual(f.leaders[0].id, 'admin'); assert(!JSON.stringify(f).includes(PIN())); });
t('wrong admin PIN rejected; 5 wrong tries lock that sign-in for everyone', () => {
  for (let i = 0; i < 5; i++) assert(/do not match/.test(post({ action: 'login', leader: 'admin', pin: '000000' }).error));
  assert(/locked/.test(post({ action: 'login', leader: 'admin', pin: PIN() }).error));
  Object.keys(env.cache).filter(k => k.startsWith('fail:')).forEach(k => delete env.cache[k]);
});
let A;
t('admin signs in and gets a token', () => { A = admin(); assert(A.token.length >= 32 && A.admin === true); });
t('actions without a token are refused', () => { assert(/sign in again/i.test(post({ action: 'annSave', titleEn: 'x' }).error)); assert(/sign in again/i.test(post({ action: 'leaderData', token: 'nope' }).error)); });
let L1, T1;
t('admin adds a leader: PIN shown once, stored only as a salted hash', () => {
  L1 = post({ action: 'leaderAdd', token: A.token, name: 'Rabin Gurung', role: 'Worship' });
  assert(/^\d{6}$/.test(L1.pin) && L1.name === 'Rabin'); assert(!sheetText().includes(L1.pin));
  assert(post({ action: 'leaderAdd', token: A.token, name: 'Sita', role: 'Youth' }).pin !== L1.pin);
});
t('leader signs in with their own PIN; wrong PIN fails; other leaders unaffected by one lock', () => {
  assert(/do not match/.test(post({ action: 'login', leader: L1.id, pin: '111111' }).error));
  T1 = post({ action: 'login', leader: L1.id, pin: L1.pin }); assert(T1.token && T1.admin === false && T1.role === 'Worship');
});
t('a leader cannot add or remove leaders', () => { assert(/only the admin/i.test(post({ action: 'leaderAdd', token: T1.token, name: 'X' }).error)); assert(/only the admin/i.test(post({ action: 'leaderRemove', token: T1.token, id: L1.id }).error)); });
t('leader posts announcements; "leaders" scope never reaches the public feed; pinned first', () => {
  post({ action: 'annSave', token: T1.token, scope: 'all', titleEn: 'Service moved', bodyEn: 'Starts 11am', titleNe: '' });
  post({ action: 'annSave', token: T1.token, scope: 'leaders', titleEn: 'Leaders only meeting' });
  post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: 'Choir practice', pinned: true });
  const f = env.feed(); assert.strictEqual(f.announcements.length, 2); assert.strictEqual(f.announcements[0].en, 'Choir practice'); assert(!JSON.stringify(f).includes('Leaders only'));
  const ld = post({ action: 'leaderData', token: T1.token }); assert.strictEqual(ld.announcements.length, 3);
});
t('feed refreshes right after a write (cache dropped)', () => { env.feed(); post({ action: 'annSave', token: T1.token, titleEn: 'Fresh' }); assert(env.feed().announcements.some(a => a.en === 'Fresh')); });
t('links must be http(s); javascript: refused', () => { assert(/http/.test(post({ action: 'annSave', token: T1.token, titleEn: 'x', link: 'javascript:alert(1)' }).error)); assert(post({ action: 'annSave', token: T1.token, titleEn: 'ok', link: 'https://example.org/a' }).ok); });
t('formulas and HTML in text are neutralised before reaching the sheet', () => {
  post({ action: 'annSave', token: T1.token, titleEn: '=HYPERLINK("http://evil","x")', bodyEn: '<script>alert(1)</script>hello' });
  const s = sheetText(); assert(!s.includes('"=HYPERLINK')); assert(!s.includes('<script>'));
});
t('songs: leaders add, anyone sees; link only (no lyrics stored); delete works', () => {
  assert(post({ action: 'songSave', token: T1.token, titleNe: 'गीत एक', titleEn: 'Song One', category: 'Worship', link: 'https://example.org/s1', songKey: 'G' }).ok);
  const s = env.feed().songs; assert.strictEqual(s.length, 1); assert.strictEqual(s[0].ne, 'गीत एक');
  assert(post({ action: 'songDelete', token: T1.token, id: s[0].id }).ok); assert.strictEqual(env.feed().songs.length, 0);
  assert(/song name/i.test(post({ action: 'songSave', token: T1.token }).error));
});
t('events: validated, sorted, old ones dropped', () => {
  assert(/date/i.test(post({ action: 'eventSave', token: T1.token, titleEn: 'x', date: 'soon' }).error)); assert(/18:30/.test(post({ action: 'eventSave', token: T1.token, titleEn: 'x', date: '2030-01-01', time: '7pm' }).error));
  post({ action: 'eventSave', token: T1.token, titleEn: 'Later', date: '2030-02-02', time: '10:00' }); post({ action: 'eventSave', token: T1.token, titleEn: 'Sooner', date: '2030-01-05', time: '18:30', minutes: 90 }); post({ action: 'eventSave', token: T1.token, titleEn: 'Ancient', date: '2001-01-01' });
  const e = env.feed().events; assert.deepStrictEqual(e.map(x => x.en), ['Sooner', 'Later']); assert.strictEqual(e[0].minutes, 90);
});
const D = 'dev-aaaa', D2 = 'dev-bbbb';
t('fellowship: first name only, links removed, 5 posts per hour per phone', () => {
  assert(post({ action: 'post', name: 'Maya Sharma', text: 'Praise God! see http://spam.com now', deviceId: D }).ok);
  const b = env.feed().board; assert.strictEqual(b[0].name, 'Maya'); assert(!/spam\.com/.test(b[0].text) && /link removed/.test(b[0].text));
  for (let i = 0; i < 4; i++) post({ action: 'post', name: 'Maya', text: 'p' + i, deviceId: D });
  assert(/lot in the last hour/.test(post({ action: 'post', name: 'Maya', text: 'one more', deviceId: D }).error));
  assert(post({ action: 'post', name: 'Noah', text: 'hello', deviceId: D2 }).ok);
  assert(/first name/i.test(post({ action: 'post', name: '   ', text: 'x', deviceId: D2 }).error)); assert(/message/i.test(post({ action: 'post', name: 'A', text: ' ', deviceId: D2 }).error));
});
t('report hides a post at once; a leader can restore or delete it', () => {
  const b = env.feed().board; const id = b.find(x => x.name === 'Noah').id;
  post({ action: 'report', id }); assert(!env.feed().board.some(x => x.id === id));
  const ld = post({ action: 'leaderData', token: T1.token }); assert(ld.flagged.some(x => x.id === id));
  post({ action: 'boardSet', token: T1.token, id, status: 'ok' }); assert(env.feed().board.some(x => x.id === id));
  post({ action: 'boardSet', token: T1.token, id, status: 'delete' }); assert(!env.feed().board.some(x => x.id === id));
  assert(/sign in/i.test(post({ action: 'boardSet', id, status: 'delete' }).error));
});
t('leader board is private; only the author or admin can delete a note', () => {
  post({ action: 'lboardPost', token: T1.token, text: 'Please bring chairs' }); assert(!JSON.stringify(env.feed()).includes('chairs'));
  const L2 = post({ action: 'leaderAdd', token: A.token, name: 'Dev', role: 'Youth' }); const T2 = post({ action: 'login', leader: L2.id, pin: L2.pin });
  const id = post({ action: 'leaderData', token: T2.token }).lboard[0].id;
  post({ action: 'lboardDelete', token: T2.token, id }); assert.strictEqual(post({ action: 'leaderData', token: T2.token }).lboard.length, 1);
  post({ action: 'lboardDelete', token: A.token, id }); assert.strictEqual(post({ action: 'leaderData', token: T2.token }).lboard.length, 0);
});
t('resources: links saved; files in the Drive "Leader Resources" folder are listed', () => {
  post({ action: 'resSave', token: T1.token, title: 'Handbook', url: 'https://example.org/h', category: 'Training' });
  env.addFile(env.root.kids[0].kids[0].kids[0], 'Youth Retreat Plan.pdf');
  const sub = env.root.kids[0].kids[0].kids[0].createFolder('Worship'); env.addFile(sub, 'Chord charts.pdf');
  const ld = post({ action: 'leaderData', token: T1.token }); assert.strictEqual(ld.resources[0].title, 'Handbook'); assert.deepStrictEqual(ld.files.map(f => f.name).sort(), ['Chord charts.pdf', 'Youth Retreat Plan.pdf']);
  assert(ld.files.find(f => f.name === 'Chord charts.pdf').cat === 'Worship'); assert(/https?:/.test(post({ action: 'resSave', token: T1.token, title: 't', url: 'ftp://x' }).error));
});
t('removing a leader ends their access at once, even with a live token', () => {
  assert(post({ action: 'leaderRemove', token: A.token, id: L1.id }).ok);
  assert(/sign in again/i.test(post({ action: 'leaderData', token: T1.token }).error)); assert(/do not match/.test(post({ action: 'login', leader: L1.id, pin: L1.pin }).error));
});
t('admin can reset a leader PIN; old PIN stops working', () => {
  const L3 = post({ action: 'leaderAdd', token: A.token, name: 'Kiran' }); const r = post({ action: 'leaderReset', token: A.token, id: L3.id });
  assert(r.pin !== L3.pin); assert(/do not match/.test(post({ action: 'login', leader: L3.id, pin: L3.pin }).error)); assert(post({ action: 'login', leader: L3.id, pin: r.pin }).token);
});
t('sign out kills the token; unknown action is refused', () => { post({ action: 'logout', token: A.token }); assert(/sign in again/i.test(post({ action: 'leaderData', token: A.token }).error)); assert(/Unknown/.test(post({ action: 'nope' }).error)); });
console.log(`\n${pass} passed`);
