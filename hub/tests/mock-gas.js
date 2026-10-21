// In-memory mock of the Google Apps Script services used by hub/Code.gs
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
function makeHub(srcPath) {
  const src = fs.readFileSync(srcPath || path.join(__dirname, '..', 'Code.gs'), 'utf8');
  const sheetsById = {}; let idc = 0;
  class Sheet {
    constructor(n) { this.name = n; this.rows = [[]]; }
    setName(n) { this.name = n; } getName() { return this.name; }
    getMaxRows() { return 1000; } getMaxColumns() { return 26; } getLastRow() { return this.rows.length; }
    getDataRange() { const r = this.rows; return { getValues: () => r.map(x => x.slice()) }; }
    deleteRow(n) { this.rows.splice(n - 1, 1); }
    getRange(r, c) { const sh = this; const o = { setNumberFormat() { return o; }, setValue(v) { while (sh.rows.length < r) sh.rows.push([]); sh.rows[r - 1][c - 1] = v; return o; }, setValues(vs) { vs.forEach((row, i) => { while (sh.rows.length < r + i) sh.rows.push([]); row.forEach((v, j) => { sh.rows[r + i - 1][c + j - 1] = v; }); }); return o; } }; return o; }
  }
  class SS { constructor(n) { this.name = n; this.id = 'ss' + (++idc); this.sheets = [new Sheet('Sheet1')]; sheetsById[this.id] = this; }
    getSheets() { return this.sheets; } getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; } insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; } getId() { return this.id; } getUrl() { return 'https://x/' + this.id; } }
  let fid = 0;
  class Folder { constructor(n) { this.name = n; this.id = 'f' + (++fid); this.kids = []; this.files = []; }
    getFoldersByName(n) { const m = this.kids.filter(k => k.name === n); let i = 0; return { hasNext: () => i < m.length, next: () => m[i++] }; }
    getFolders() { let i = 0; const k = this.kids; return { hasNext: () => i < k.length, next: () => k[i++] }; }
    getFiles() { let i = 0; const f = this.files; return { hasNext: () => i < f.length, next: () => f[i++] }; }
    createFolder(n) { const f = new Folder(n); this.kids.push(f); return f; } getId() { return this.id; } getName() { return this.name; } }
  const root = new Folder('My Drive'); const folders = {}; const reg = f => { folders[f.id] = f; f.kids.forEach(reg); };
  const props = {}, cache = {}; const moved = [];
  const addFile = (folder, name) => folder.files.push({ getName: () => name, getUrl: () => 'https://drive/' + name, getMimeType: () => 'application/pdf', getLastUpdated: () => new Date('2026-10-01T00:00:00Z') });
  const mails = [], triggers = [], docTables = {}, driveDocs = [];
  const sb = {
    console,
    SpreadsheetApp: { create: n => new SS(n), openById: id => sheetsById[id] },
    DocumentApp: { openById: id => { if (!docTables[id]) throw new Error('no doc'); const tables = docTables[id].map(rows => ({ getNumRows: () => rows.length, getRow: r => ({ getNumCells: () => rows[r].length, getCell: c => ({ getText: () => rows[r][c] }) }) })); return { getBody: () => ({ getTables: () => tables }) }; } },
    DriveApp: { searchFiles: () => { const l = driveDocs.slice(); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }, getRootFolder: () => root, getFileById: id => ({ moveTo: f => moved.push({ id, folder: f.name }), makeCopy: (name, folder) => { const f = { getName: () => name, getUrl: () => 'https://drive/' + name, getMimeType: () => 'application/vnd.google-apps.spreadsheet', getLastUpdated: () => new Date(), setTrashed: () => { const i = folder.files.indexOf(f); if (i >= 0) folder.files.splice(i, 1); env.trashed.push(name); } }; folder.files.push(f); env.copies.push(name); return f; } }), getFolderById: id => { reg(root); return folders[id]; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    LanguageApp: { translate: (t, f, to) => '[' + to + '] ' + t },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => { delete cache[k]; }) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }) },
    Utilities: {
      formatDate: (d, tz, pat) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d); const g = t => p.find(x => x.type === t).value; return pat.replace('yyyy', g('year')).replace('MM', g('month')).replace('dd', g('day')).replace('HH', g('hour')).replace('mm', g('minute')); },
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b))
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.org' }) },
    MailApp: { sendEmail: (to, subject, body) => { mails.push({ to, subject, body }); } },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); }, newTrigger: fn => { const t = { getHandlerFunction: () => fn, spec: [] }; const c = { timeBased: () => c, onMonthDay: d => { t.spec.push('day' + d); return c; }, atHour: h => { t.spec.push('h' + h); return c; }, inTimezone: z => c, nearMinute: m => c, create: () => { triggers.push(t); return t; } }; return c; } },
    Logger: { log: m => { if (process.env.HUBDEBUG) console.log("LOG", m); } }
  };
  const ctx = vm.createContext(sb); vm.runInContext(src, ctx);
  const call = (fn, ...a) => vm.runInContext(fn, ctx)(...a);
  const env = { addDoc: (id, name, tables) => { docTables[id] = tables; driveDocs.push({ getId: () => id, getName: () => name, getLastUpdated: () => new Date() }); }, props, cache, sheetsById, root, moved, addFile, call, mails, triggers, copies: [], trashed: [] };
  env.post = b => JSON.parse(call('doPost', { postData: { contents: JSON.stringify(b) } }).getContent());
  env.feed = () => JSON.parse(call('doGet', { parameter: { action: 'hub' } }).getContent());
  return env;
}
module.exports = { makeHub };
