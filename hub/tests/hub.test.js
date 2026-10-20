const assert = require('assert'); const { makeHub } = require('./mock-gas');
const env = makeHub(); let pass = 0;
const t = (n, f) => { try { f(); pass++; console.log('  ok  ' + n); } catch (e) { console.error('FAIL  ' + n + '\n      ' + e.message); process.exitCode = 1; } };
const post = b => env.post(b);
const sheetText = () => JSON.stringify(Object.values(env.sheetsById).map(s => s.sheets.map(x => x.rows)));
env.call('setup');
const PIN = () => env.props.ADMIN_PIN;
const admin = () => post({ action: 'login', leader: 'admin', pin: PIN() });
console.log('Hub backend tests');
t('setup creates folders, sheet with 10 tabs, admin PIN; safe to run twice', () => {
  assert.strictEqual(env.root.kids[0].name, 'Executive Assistant Workspace'); assert.strictEqual(env.root.kids[0].kids[0].name, 'AGC Connect'); assert.strictEqual(env.root.kids[0].kids[0].kids[0].name, 'Leader Resources');
  assert(/^\d{6}$/.test(PIN())); assert.strictEqual(Object.values(env.sheetsById)[0].sheets.length, 10);
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
  L1 = post({ action: 'leaderAdd', token: A.token, name: 'Rabin Gurung', role: 'Worship leader', areas: ['worship'] });
  assert(/^\d{6}$/.test(L1.pin) && L1.name === 'Rabin'); assert(!sheetText().includes(L1.pin));
  assert(post({ action: 'leaderAdd', token: A.token, name: 'Sita', role: 'Youth' }).pin !== L1.pin);
});
t('leader signs in with their own PIN; wrong PIN fails; other leaders unaffected by one lock', () => {
  assert(/do not match/.test(post({ action: 'login', leader: L1.id, pin: '111111' }).error));
  T1 = post({ action: 'login', leader: L1.id, pin: L1.pin }); assert(T1.token && T1.admin === false && T1.role === 'Worship leader' && T1.areas[0] === 'worship');
});
t('a leader cannot add or remove leaders', () => { assert(/only the admin/i.test(post({ action: 'leaderAdd', token: T1.token, name: 'X' }).error)); assert(/only the admin/i.test(post({ action: 'leaderRemove', token: T1.token, id: L1.id }).error)); });
t('assignments: only leaders with the matching area can post; admin can; public feed carries them', () => {
  assert(/not allowed|access|permission|do not/i.test(post({ action: 'asgSave', token: T1.token, group: 'kids', title: 'X' }).error || ''));
  const r = post({ action: 'asgSave', token: A.token, group: 'kids', title: 'Learn Psalm 23', due: '2031-02-02' }); assert(r.ok && r.id);
  assert(/title/i.test(post({ action: 'asgSave', token: A.token, group: 'kids' }).error));
  const f = env.feed(); assert(f.assignments.some(a => a.title === 'Learn Psalm 23' && a.group === 'kids'));
  assert(post({ action: 'asgDelete', token: A.token, id: r.id }).ok);
});
t('progress: phones send weekly stats without signing in; leaders with the area read them; others cannot', () => {
  const base = { action: 'progSend', childId: 'c1abc', deviceId: 'dev-1', group: 'kids', name: 'Anan Rai', week: '2026-10-18', stars: 12, learned: 2, steps: 9, games: 3, hwDone: 1, hwTotal: 2 };
  assert(post(base).ok); assert(post(Object.assign({}, base, { stars: 20 })).ok);
  assert(/not allowed/i.test(post(Object.assign({}, base, { deviceId: 'dev-2' })).error));
  assert(/bad week/i.test(post(Object.assign({}, base, { week: 'x' })).error));
  const a = post({ action: 'progList', token: A.token, group: 'kids' }); assert(a.rows.length === 1 && a.rows[0].stars === 20 && a.rows[0].name === 'Anan' && a.rows[0].cid === 'c1abc');
  assert(/access/i.test(post({ action: 'progList', token: T1.token, group: 'kids' }).error));
  assert(!JSON.stringify(env.feed()).includes('Anan'), 'public feed must not carry child data');
});
t('progress: parent can forget their child; leader with area can remove; wrong phone cannot', () => {
  const b = { action: 'progSend', childId: 'c2xyz', deviceId: 'dev-9', group: 'youth', name: 'Sam', week: '2026-10-18', stars: 5 };
  assert(post(b).ok);
  assert(post({ action: 'progForget', childId: 'c2xyz', deviceId: 'other' }).removed === 0);
  assert(post({ action: 'progForget', childId: 'c2xyz', deviceId: 'dev-9' }).removed === 1);
  assert(post(b).ok); assert(post({ action: 'progRemove', token: A.token, group: 'youth', cid: 'c2xyz' }).ok);
  assert(post({ action: 'progList', token: A.token, group: 'youth' }).rows.length === 0);
});
t('weekly verse and lesson: only the matching area posts; newest shows in the public feed', () => {
  assert(/access/i.test(post({ action: 'weeklySave', token: T1.token, group: 'kids', verse: 'John 3:16' }).error));
  assert(post({ action: 'weeklySave', token: A.token, group: 'kids', verse: 'Psalm 23:1', lessonEn: 'The Lord is my shepherd.' }).ok);
  assert(post({ action: 'weeklySave', token: A.token, group: 'kids', verse: 'John 3:16', verseEn: 'For God so loved the world' }).ok);
  const f = env.feed(); assert(f.weekly.kids.verse === 'John 3:16' && f.weekly.kids.verseEn.startsWith('For God') && !f.weekly.youth);
  assert(/type a verse/i.test(post({ action: 'weeklySave', token: A.token, group: 'kids' }).error));
});
t('leader posts announcements; "leaders" scope never reaches the public feed; pinned first', () => {
  post({ action: 'annSave', token: A.token, scope: 'all', titleEn: 'Service moved', bodyEn: 'Starts 11am', titleNe: '' });
  post({ action: 'annSave', token: T1.token, scope: 'leaders', titleEn: 'Leaders only meeting' });
  post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: 'Choir practice', pinned: true });
  const f = env.feed(); assert.strictEqual(f.announcements.length, 2); assert.strictEqual(f.announcements[0].en, 'Choir practice'); assert(!JSON.stringify(f).includes('Leaders only'));
  const ld = post({ action: 'leaderData', token: T1.token }); assert.strictEqual(ld.announcements.length, 3);
});
t('feed refreshes right after a write (cache dropped)', () => { env.feed(); post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: 'Fresh' }); assert(env.feed().announcements.some(a => a.en === 'Fresh')); });
t('links must be http(s); javascript: refused', () => { assert(/http/.test(post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: 'x', link: 'javascript:alert(1)' }).error)); assert(post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: 'ok', link: 'https://example.org/a' }).ok); });
t('formulas and HTML in text are neutralised before reaching the sheet', () => {
  post({ action: 'annSave', token: T1.token, scope: 'worship', titleEn: '=HYPERLINK("http://evil","x")', bodyEn: '<script>alert(1)</script>hello' });
  const s = sheetText(); assert(!s.includes('"=HYPERLINK')); assert(!s.includes('<script>'));
});
t('songs: leaders add, anyone sees; link only (no lyrics stored); delete works', () => {
  assert(post({ action: 'songSave', token: T1.token, titleNe: 'गीत एक', titleEn: 'Song One', category: 'Worship', link: 'https://example.org/s1', songKey: 'G' }).ok);
  const s = env.feed().songs; assert.strictEqual(s.length, 1); assert.strictEqual(s[0].ne, 'गीत एक');
  assert(post({ action: 'songDelete', token: T1.token, id: s[0].id }).ok); assert.strictEqual(env.feed().songs.length, 0);
  assert(/song name/i.test(post({ action: 'songSave', token: T1.token }).error));
});
t('events: validated, sorted, old ones dropped', () => {
  assert(/date/i.test(post({ action: 'eventSave', token: T1.token, area: 'worship', titleEn: 'x', date: 'soon' }).error)); assert(/18:30/.test(post({ action: 'eventSave', token: T1.token, area: 'worship', titleEn: 'x', date: '2030-01-01', time: '7pm' }).error));
  post({ action: 'eventSave', token: T1.token, area: 'worship', titleEn: 'Later', date: '2030-02-02', time: '10:00' }); post({ action: 'eventSave', token: T1.token, area: 'worship', titleEn: 'Sooner', date: '2030-01-05', time: '18:30', minutes: 90 }); post({ action: 'eventSave', token: T1.token, area: 'worship', titleEn: 'Ancient', date: '2001-01-01' });
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
const RF = () => env.root.kids[0].kids[0].kids[0];
const sub = n => RF().kids.find(k => k.name === n);
t('setup makes the group folders under Leader Resources', () => { assert.deepStrictEqual(RF().kids.map(k => k.name), ['All Leaders', 'Kids', 'Youth', 'Worship']); });
t('only the admin can add or remove resource links; leaders can read them', () => {
  assert(/do not match|admin/i.test(post({ action: 'resSave', token: T1.token, title: 'x', url: 'https://example.org' }).error));
  assert(post({ action: 'resSave', token: A.token, title: 'Handbook', url: 'https://example.org/h', category: 'Worship' }).ok);
  assert(post({ action: 'resSave', token: A.token, title: 'Kids guide', url: 'https://example.org/k', category: 'Kids' }).ok);
  assert(/https?:/.test(post({ action: 'resSave', token: A.token, title: 't', url: 'ftp://x' }).error));
  const ld = post({ action: 'leaderData', token: T1.token }); assert.deepStrictEqual(ld.resources.map(r => r.title), ['Handbook']);
  const id = post({ action: 'leaderData', token: A.token }).resources[0].id; assert(/admin/i.test(post({ action: 'resDelete', token: T1.token, id }).error));
});
t('Drive files are filtered by area: a worship leader sees Worship + All Leaders + loose files only', () => {
  env.addFile(RF(), 'Loose file.pdf'); env.addFile(sub('All Leaders'), 'Handbook.pdf'); env.addFile(sub('Worship'), 'Chord charts.pdf'); env.addFile(sub('Kids'), 'Kids curriculum.pdf'); env.addFile(sub('Youth'), 'Youth retreat.pdf');
  const odd = RF().createFolder('Finance'); env.addFile(odd, 'Budget.pdf');
  const names = r => r.files.map(f => f.name).sort();
  assert.deepStrictEqual(names(post({ action: 'leaderData', token: T1.token })), ['Chord charts.pdf', 'Handbook.pdf', 'Loose file.pdf']);
  assert.deepStrictEqual(names(post({ action: 'leaderData', token: A.token })), ['Budget.pdf', 'Chord charts.pdf', 'Handbook.pdf', 'Kids curriculum.pdf', 'Loose file.pdf', 'Youth retreat.pdf']);
});
t('Sunday school leader (kids): sees Kids files, cannot post to worship or youth, cannot add songs', () => {
  const K = post({ action: 'leaderAdd', token: A.token, name: 'Mira', role: 'Sunday school', areas: ['kids'] }); const TK = post({ action: 'login', leader: K.id, pin: K.pin });
  assert.deepStrictEqual(TK.areas, ['kids']);
  assert.deepStrictEqual(post({ action: 'leaderData', token: TK.token }).files.map(f => f.name).sort(), ['Handbook.pdf', 'Kids curriculum.pdf', 'Loose file.pdf']);
  assert(post({ action: 'annSave', token: TK.token, scope: 'kids', titleEn: 'Kids picnic' }).ok);
  assert(/do not have access/.test(post({ action: 'annSave', token: TK.token, scope: 'worship', titleEn: 'x' }).error)); assert(/do not have access/.test(post({ action: 'annSave', token: TK.token, scope: 'youth', titleEn: 'x' }).error)); assert(/do not have access/.test(post({ action: 'annSave', token: TK.token, scope: 'all', titleEn: 'x' }).error));
  assert(/do not have access/.test(post({ action: 'songSave', token: TK.token, titleNe: 'x' }).error)); assert(/do not have access/.test(post({ action: 'eventSave', token: TK.token, area: 'all', titleEn: 'x', date: '2030-03-03' }).error));
  assert(post({ action: 'eventSave', token: TK.token, area: 'kids', titleEn: 'Kids day', date: '2030-03-03' }).ok);
  const worshipAnn = env.feed().announcements.find(a => a.en === 'Choir practice'); assert(/do not have access/.test(post({ action: 'annDelete', token: TK.token, id: worshipAnn.id }).error));
  assert(env.feed().announcements.some(a => a.scope === 'kids' && a.en === 'Kids picnic'));
  assert(!post({ action: 'leaderData', token: TK.token }).announcements.some(a => a.en === 'Choir practice'));
});
t('leader board areas: a kids note is hidden from worship leaders; everyone sees "all leaders"; admin sees all', () => {
  const team = post({ action: 'leaderData', token: A.token }).team; const mira = team.find(x => x.name === 'Mira'); const rs = post({ action: 'leaderReset', token: A.token, id: mira.id });
  const TK = post({ action: 'login', leader: mira.id, pin: rs.pin });
  assert(post({ action: 'lboardPost', token: TK.token, area: 'kids', text: 'Kids-only plan' }).ok); assert(post({ action: 'lboardPost', token: TK.token, text: 'To all leaders' }).ok);
  assert(/do not have access/.test(post({ action: 'lboardPost', token: TK.token, area: 'worship', text: 'x' }).error));
  const seen = tok => post({ action: 'leaderData', token: tok }).lboard.map(m => m.text);
  assert(!seen(T1.token).includes('Kids-only plan') && seen(T1.token).includes('To all leaders')); assert(seen(TK.token).includes('Kids-only plan')); assert(seen(A.token).includes('Kids-only plan'));
});
t('changing a leader\'s areas takes effect at once for a signed-in leader', () => {
  const id = post({ action: 'leaderData', token: A.token }).team.find(x => x.name === 'Rabin').id;
  assert(post({ action: 'leaderAreas', token: A.token, id, areas: ['worship', 'youth', 'bogus'] }).ok);
  assert(post({ action: 'annSave', token: T1.token, scope: 'youth', titleEn: 'Youth camp' }).ok);
  assert(post({ action: 'leaderAreas', token: A.token, id, areas: ['worship'] }).ok);
  assert(/do not have access/.test(post({ action: 'annSave', token: T1.token, scope: 'youth', titleEn: 'again' }).error));
  assert(/admin/i.test(post({ action: 'leaderAreas', token: T1.token, id, areas: ['kids'] }).error));
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
const sheetNamed = n => Object.values(env.sheetsById)[0].sheets.find(s => s.name === n);
t('monthly upkeep: installs one monthly trigger (safe to run twice)', () => {
  env.call('installTriggers'); env.call('installTriggers');
  assert.strictEqual(env.triggers.length, 1); assert.deepStrictEqual(env.triggers[0].spec.sort(), ['day1', 'h6'].sort());
});
t('monthly upkeep: removes old rows, keeps recent ones, emails the owner a report that flags what needs attention', () => {
  const mk = (id, week) => ({ action: 'progSend', childId: id, deviceId: 'dev-old', group: 'kids', name: 'Old' + id, week, stars: 1 });
  assert(post(mk('oldkid', '2019-01-06')).ok); assert(post(mk('newkid', new Date().toISOString().slice(0, 10))).ok);
  const before = sheetNamed('Progress').rows.length;
  const r = env.call('monthlyMaintenance'); assert(r.ok);
  assert.strictEqual(sheetNamed('Progress').rows.length, before - 1);
  assert(sheetNamed('Progress').rows.some(x => String(x[0]).startsWith('newkid')) && !sheetNamed('Progress').rows.some(x => String(x[0]).startsWith('oldkid')));
  const m = env.mails[env.mails.length - 1]; assert.strictEqual(m.to, 'owner@example.org'); assert(/monthly report/.test(m.subject) && /removed 1 old progress/.test(m.body));
});
t('monthly upkeep: says all is well when weekly posts are fresh and nothing is waiting', () => {
  const A2 = admin(); assert(post({ action: 'weeklySave', token: A2.token, group: 'kids', verse: 'John 1:1' }).ok); assert(post({ action: 'weeklySave', token: A2.token, group: 'youth', verse: 'John 1:2' }).ok);
  const flagged = Object.values(env.sheetsById)[0].sheets.find(s => s.name === 'Fellowship').rows.slice(1).filter(x => x[3] && x[3] !== 'ok').length;
  env.call('monthlyMaintenance'); const m = env.mails[env.mails.length - 1];
  assert(!/last weekly verse|no weekly verse/.test(m.body), m.body);
  if (!flagged) assert(/all is well/.test(m.subject), m.subject);
});


t('monthly maintenance makes a backup copy and keeps only the newest 6', () => {
  const n0 = env.copies.length;
  env.call('monthlyMaintenance');
  assert.strictEqual(env.copies.length, n0 + 1); assert(/^AGC Connect - Hub Data backup 20\d\d-\d\d$/.test(env.copies[env.copies.length - 1]));
  const app = env.root.kids.find(k => k.name === 'Executive Assistant Workspace').kids.find(k => k.name === 'AGC Connect');
  for (let i = 1; i <= 8; i++) app.files.push({ getName: () => 'AGC Connect - Hub Data backup 2019-0' + i, setTrashed: () => { const j = app.files.findIndex(f => f.getName() === 'AGC Connect - Hub Data backup 2019-0' + i); if (j >= 0) app.files.splice(j, 1); env.trashed.push('2019-0' + i); } });
  env.call('monthlyMaintenance');
  const kept = app.files.filter(f => f.getName().indexOf('AGC Connect - Hub Data backup') === 0).length;
  assert.strictEqual(kept, 6); assert(env.trashed.length >= 3);
  assert(/Backup saved/.test(env.mails[env.mails.length - 1].body));
});
console.log(`\n${pass} passed`);
