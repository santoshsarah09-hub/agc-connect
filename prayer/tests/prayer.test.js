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
console.log(`\n${pass} passed`);
