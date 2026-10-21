const assert = require('assert'); const path = require('path');
const { makeHub } = require('../../hub/tests/mock-gas');
const env = makeHub(path.join(__dirname, '..', 'backend', 'Code.gs')); let pass = 0;
const t = (n, f) => { try { f(); pass++; console.log('  ok  ' + n); } catch (e) { console.error('FAIL  ' + n + '\n      ' + e.message); process.exitCode = 1; } };
const post = b => JSON.parse(env.call('doPost', { postData: { contents: JSON.stringify(b) } }).getContent());
env.call('setup'); const PIN = env.props.ADMIN_PIN;
const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
const state = () => JSON.parse(env.call('doGet', { parameter: { action: 'state', month, deviceId: 'x' } }).getContent());
console.log('Prayer chain backend tests');
t('anyone can send a request; it does NOT appear on the public list', () => {
  assert(post({ action: 'submit', text: 'Pray for my mother, she has surgery Friday', name: 'Anan Rai', deviceId: 'dev1' }).ok);
  assert.strictEqual(state().requests.length, 0);
  assert(!JSON.stringify(state()).includes('surgery'));
});
t('waiting list is admin-only', () => {
  assert(/admin PIN/i.test(post({ action: 'pending', pin: '000000' }).error));
  const r = post({ action: 'pending', pin: PIN }); assert.strictEqual(r.pending.length, 1); assert.strictEqual(r.pending[0].name, 'Anan'); assert(!JSON.stringify(r).includes('dev1'));
});
t('links and tags are removed; empty is refused; anonymous drops the name', () => {
  assert(/type your request/i.test(post({ action: 'submit', text: '   ', deviceId: 'dev2' }).error));
  post({ action: 'submit', text: '<b>Hello</b> see http://evil.example/x now', name: 'Sam', anon: true, deviceId: 'dev2' });
  const p = post({ action: 'pending', pin: PIN }).pending; const q = p[p.length - 1];
  assert(q.text === 'Hello see [link removed] now' && q.name === '' && q.anon === true, JSON.stringify(q));
});
t('rate limit: 3 requests per phone', () => {
  for (let i = 0; i < 3; i++) post({ action: 'submit', text: 'r' + i, deviceId: 'dev3' });
  assert(/several requests/i.test(post({ action: 'submit', text: 'again', deviceId: 'dev3' }).error));
});
t('admin adds a request to the month list (saveRequests with approved ids); it then shows publicly and leaves the waiting list', () => {
  const p = post({ action: 'pending', pin: PIN }).pending; const first = p[0];
  assert(post({ action: 'saveRequests', pin: PIN, month, requests: [{ en: first.text + ' (Anan)', ne: '', status: 'active' }], approved: [first.id] }).ok);
  assert.strictEqual(state().requests.length, 1);
  assert(!post({ action: 'pending', pin: PIN }).pending.some(x => x.id === first.id));
});
t('only the admin can change the list or mark answered', () => {
  assert(/admin PIN/i.test(post({ action: 'saveRequests', pin: 'nope', month, requests: [] }).error));
  assert.strictEqual(state().requests.length, 1);
  assert(post({ action: 'saveRequests', pin: PIN, month, requests: [{ en: 'Pray for my mother (Anan)', ne: '', status: 'answered' }] }).ok);
  assert.strictEqual(state().requests[0].status, 'answered');
});
t('admin can dismiss a request', () => {
  const p = post({ action: 'pending', pin: PIN }).pending; const n = p.length;
  assert(post({ action: 'dismiss', pin: PIN, id: p[0].id }).ok);
  assert.strictEqual(post({ action: 'pending', pin: PIN }).pending.length, n - 1);
  assert(/admin PIN/i.test(post({ action: 'dismiss', pin: 'x', id: p[1].id }).error));
});
t('alert email: first request emails the owner without the request text; more within the hour do not; admin can still see all', () => {
  const env2 = env; const before = env2.mails.length;
  Object.keys(env2.cache).filter(k => k.startsWith('alert:')).forEach(k => delete env2.cache[k]);
  assert(post({ action: 'submit', text: 'Private health matter for Sam', deviceId: 'dev-al1' }).ok);
  assert.strictEqual(env2.mails.length, before + 1); const m = env2.mails[env2.mails.length - 1];
  assert(/new prayer request/i.test(m.subject) && !/Private health|Sam/.test(m.subject + m.body) && m.to === 'owner@example.org');
  assert(post({ action: 'submit', text: 'Another one', deviceId: 'dev-al2' }).ok); assert.strictEqual(env2.mails.length, before + 1, 'throttled within the hour');
});
t('weekly group prayer: admin sets Friday 12:00 for an hour; this and next month fill in; a deleted day stays gone; off stops it', () => {
  assert(/admin PIN/i.test(post({ action: 'weeklySet', pin: 'x', on: true, dow: 5, time: '12:00', en: 'Fasting' }).error));
  assert(/title/i.test(post({ action: 'weeklySet', pin: PIN, on: true, dow: 5, time: '12:00', en: '', ne: '' }).error)); assert(/time/i.test(post({ action: 'weeklySet', pin: PIN, on: true, dow: 5, time: 'noon', en: 'x' }).error)); assert(/day/i.test(post({ action: 'weeklySet', pin: PIN, on: true, dow: 9, time: '12:00', en: 'x' }).error));
  const r = post({ action: 'weeklySet', pin: PIN, on: true, dow: 5, time: '12:00', dur: 60, en: 'Weekly Fasting Prayer', ne: 'साप्ताहिक उपवास प्रार्थना', req: false }); assert(r.ok && r.created > 3, JSON.stringify(r));
  const st = state(); const fr = st.sessions.filter(q => q.en === 'Weekly Fasting Prayer'); assert(fr.length >= 1);
  fr.forEach(q => { assert.strictEqual(new Date(q.d + 'T12:00:00Z').getUTCDay(), 5, 'every date is a Friday'); assert(q.t === '12:00' && q.dur === 60 && q.req === false && q.d >= new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })); });
  const again = post({ action: 'weeklySet', pin: PIN, on: true, dow: 5, time: '12:00', dur: 60, en: 'Weekly Fasting Prayer', ne: 'साप्ताहिक उपवास प्रार्थना', req: false }); assert.strictEqual(state().sessions.filter(q => q.en === 'Weekly Fasting Prayer').length, fr.length, 'saving again does not duplicate');
  const keepN = fr.length - 1; const rest = state().sessions.filter(q => q.id !== fr[0].id).map(q => ({ id: q.id, d: q.d, t: q.t, dur: q.dur, en: q.en, ne: q.ne, link: q.link, req: q.req })); assert(post({ action: 'saveSessions', pin: PIN, month, sessions: rest }).ok);
  assert(post({ action: 'weeklyGet', pin: PIN }).weekly.dow === 5); assert.strictEqual(state().sessions.filter(q => q.en === 'Weekly Fasting Prayer').length, keepN, 'a deleted day is not brought back'); assert(/admin PIN/i.test(post({ action: 'weeklyGet', pin: 'x' }).error));
  { const off = post({ action: 'weeklySet', pin: PIN, on: false }); assert(off.ok, JSON.stringify(off)); } assert.strictEqual(post({ action: 'weeklyGet', pin: PIN }).weekly, null);
});
t('a group time can carry the "show this month\'s prayer requests" option (off by default)', () => {
  const ses = state().sessions.map(q => ({ id: q.id, d: q.d, t: q.t, dur: q.dur, en: q.en, ne: q.ne, link: q.link, req: q.req }));
  ses[0].req = true; assert(post({ action: 'saveSessions', pin: PIN, month, sessions: ses }).ok);
  const s2 = state().sessions; assert.strictEqual(s2[0].req, true); assert(s2.slice(1).every(q => q.req === false));
});
console.log(`\n${pass} passed`);
