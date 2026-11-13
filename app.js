'use strict';
/* Quiet Studio — personal trial build.
   Plain JS, no dependencies. All data lives in this browser's localStorage. */

const $ = id => document.getElementById(id);
const KEY = 'quiet-studio-two-areas-v1';          // same key as the prototype, so nothing is orphaned
const PREV_KEY = 'quiet-studio-previous-data';    // safety copy taken before any replace-everything action
const EXPORT_KEY = 'quiet-studio-last-export';
const AREAS = ['career', 'family'];
const LABEL = { career: 'Career', family: 'Family / Personal' };
const LIMIT = { short: 500, long: 5000, steps: 200, ideas: 500, file: 2000000 };

/* ───────────── Data shape ───────────── */

const blankArea = () => ({ goal: '', outcome: '', achieved: false, active: null, ideas: [], steps: [] });
const blankState = () => ({ version: 2, selected: 'career', sample: false, areas: { career: blankArea(), family: blankArea() } });
const makeStep = (id, title, why, done, action = '', complete = false) => ({ id, title, why, done, action, note: '', complete });

function sampleState() {
  return {
    version: 2, selected: 'career', sample: true, areas: {
      career: {
        goal: 'Land a remote frontend developer job.', outcome: 'A signed offer for a role I want to accept.', achieved: false, active: 'c2',
        ideas: ['Explore a Japan travel app'], steps: [
          makeStep('c1', 'Prepare a usable resume', 'Have something credible ready to send.', 'A clear resume exports correctly and includes working project links.', '', true),
          makeStep('c2', 'Send the first applications', 'Get real feedback while continuing to build.', 'Send five tailored applications and record where they went.', 'Choose one relevant frontend role and apply.'),
          makeStep('c3', 'Finish Yuki’s core flow', 'Show a finished example of your frontend work.', 'Core flow works on mobile and iPad, and the app is deployed.', 'Add the remaining people images.'),
          makeStep('c4', 'Publish a simple portfolio', 'Make your strongest work easy to find.', 'One live page introduces me and explains the Yuki project.', 'Write the project description.')
        ]
      },
      family: {
        goal: 'Make a family photo book.', outcome: 'A printed book we can enjoy together.', achieved: false, active: 'f1',
        ideas: ['Plan a weekend picnic'], steps: [
          makeStep('f1', 'Choose our favorite photos', 'Start with the memories we want to keep.', 'Choose 30 photos together and put them in one album.', 'Pick ten photos from our last family trip.'),
          makeStep('f2', 'Arrange the pages', 'Turn the photos into a story.', 'Each page has photos and a short caption.', 'Start with the opening page.'),
          makeStep('f3', 'Print and enjoy the book', 'Bring the project into family life.', 'The printed book has arrived and we have looked through it together.', 'Review the final proof.')
        ]
      }
    }
  };
}

/* ───────────── Validation (used for saved data, imports and restores) ───────────── */

function bad(msg) { const e = new Error(msg); e.user = true; throw e; }
function text(v, label, max, required) {
  if (typeof v !== 'string') bad(label + ' should be text.');
  if (v.length > max) bad(label + ' is too long (' + v.length + ' characters; the limit is ' + max + ').');
  if (required && !v.trim()) bad(label + ' can’t be empty.');
  return v;
}
function normalizeArea(a, name) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) bad(name + ' is missing.');
  const goal = text(a.goal, name + ' commitment', LIMIT.short);
  const has = goal.trim() !== '';
  const out = { goal, outcome: text(a.outcome, name + ' “Achieved when”', LIMIT.short, has), achieved: a.achieved, active: a.active ?? null, ideas: [], steps: [] };
  if (typeof out.achieved !== 'boolean') bad(name + ': “achieved” should be true or false.');
  if (!has && out.achieved) bad(name + ' is marked achieved but has no commitment.');
  if (!Array.isArray(a.ideas)) bad(name + ': parked ideas should be a list.');
  if (a.ideas.length > LIMIT.ideas) bad(name + ' has too many parked ideas (limit ' + LIMIT.ideas + ').');
  a.ideas.forEach((x, i) => out.ideas.push(text(x, name + ' idea ' + (i + 1), LIMIT.short, true)));
  if (!Array.isArray(a.steps)) bad(name + ': steps should be a list.');
  if (a.steps.length > LIMIT.steps) bad(name + ' has too many steps (limit ' + LIMIT.steps + ').');
  if (!has && a.steps.length) bad(name + ' has steps but no commitment.');
  const ids = new Set();
  a.steps.forEach((s, i) => {
    const n = name + ' step ' + (i + 1);
    if (!s || typeof s !== 'object' || Array.isArray(s)) bad(n + ' is not a valid step.');
    const id = text(s.id, n + ' id', 200, true);
    if (ids.has(id)) bad(n + ' repeats the id “' + id + '”.');
    ids.add(id);
    if (typeof s.complete !== 'boolean') bad(n + ': “complete” should be true or false.');
    out.steps.push({
      id, title: text(s.title, n + ' title', LIMIT.short, true), why: text(s.why ?? '', n + ' why', LIMIT.long),
      done: text(s.done ?? '', n + ' “done when”', LIMIT.short), action: text(s.action ?? '', n + ' next action', LIMIT.long),
      note: text(s.note ?? '', n + ' note', LIMIT.long), complete: s.complete
    });
  });
  if (out.active !== null) {
    if (typeof out.active !== 'string') bad(name + ': current step should be a step id or empty.');
    const cur = out.steps.find(s => s.id === out.active);
    if (!cur) bad(name + ': the current step points to a step that doesn’t exist.');
    if (cur.complete) bad(name + ': the current step is already completed.');
  }
  return out;
}
function normalize(raw) {
  let src = raw;
  if (src && typeof src === 'object' && !Array.isArray(src) && 'app' in src) {
    if (src.app !== 'quiet-studio') bad('This file is from a different app.');
    if (!('data' in src)) bad('This backup has no data in it.');
    src = src.data;
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) bad('This doesn’t look like a Quiet Studio backup.');
  if (src.version !== 1 && src.version !== 2) bad(typeof src.version === 'number' && src.version > 2 ? 'This backup was made by a newer version of the app.' : 'This backup has no recognised version number.');
  if (!AREAS.includes(src.selected)) bad('The selected area is missing or unknown.');
  if (src.sample !== undefined && typeof src.sample !== 'boolean') bad('The sample-data flag should be true or false.');
  if (!src.areas || typeof src.areas !== 'object') bad('The areas are missing.');
  const out = { version: 2, selected: src.selected, sample: src.sample === true, areas: {} };
  AREAS.forEach(k => { out.areas[k] = normalizeArea(src.areas[k], LABEL[k]); });
  return out;
}
function parseBackup(textValue) {
  let json;
  try { json = JSON.parse(textValue); } catch { bad('That file isn’t valid JSON, so it can’t be a Quiet Studio backup.'); }
  return normalize(json);
}

/* ───────────── Model: small operations on one area (no DOM) ───────────── */

const hasGoal = a => a.goal.trim() !== '';
const findStep = (a, id) => a.steps.find(s => s.id === id) || null;
const currentStep = a => a.steps.find(s => s.id === a.active && !s.complete) || null;
const clone = o => JSON.parse(JSON.stringify(o));
function newId(a) {
  let id;
  do { id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); } while (findStep(a, id));
  return id;
}
function completeCurrent(a) {
  const s = currentStep(a);
  if (!s) return null;
  s.complete = true;
  const i = a.steps.indexOf(s);
  const next = a.steps.slice(i + 1).find(x => !x.complete) || a.steps.find(x => !x.complete) || null;
  a.active = next ? next.id : null;
  return { step: s, next };
}
function moveStep(a, id, dir) {           // never touches a.active
  const i = a.steps.findIndex(s => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= a.steps.length) return -1;
  [a.steps[i], a.steps[j]] = [a.steps[j], a.steps[i]];
  return j;
}
function removeStepFrom(a, id) {          // removing the current step leaves NO current step
  const index = a.steps.findIndex(s => s.id === id);
  if (index < 0) return null;
  const [step] = a.steps.splice(index, 1);
  const wasActive = a.active === id;
  if (wasActive) a.active = null;
  return { step, index, wasActive };
}
function restoreStepTo(a, rec) {          // brings focus back only if nothing else was chosen meanwhile
  a.steps.splice(Math.min(rec.index, a.steps.length), 0, rec.step);
  let focusRestored = false;
  if (rec.wasActive && a.active === null && !rec.step.complete) { a.active = rec.step.id; focusRestored = true; }
  return focusRestored;
}

/* ───────────── State + storage ───────────── */

let saveBlocked = false;      // saved data exists but couldn't be read: never overwrite it
let unreadableRaw = null;
let saveProblem = null;       // 'failed' | 'unavailable' | null

function loadState() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { saveProblem = 'unavailable'; return blankState(); }
  if (raw === null) return blankState();
  try { return normalize(JSON.parse(raw)); }
  catch { saveBlocked = true; unreadableRaw = raw; return blankState(); }
}
let state = loadState();
let undoDone = { career: null, family: null };      // completion undo, per area
let undoRemoved = { career: null, family: null };   // step-removal undo, per area
let undoIdea = { career: null, family: null };      // parked-idea removal undo, per area
let undoCleared = { career: null, family: null };   // cleared-commitment undo, per area
let drafts = { career: '', family: '' };
let parkOpen = { career: false, family: false };
const resetTransient = () => {
  undoDone = { career: null, family: null }; undoRemoved = { career: null, family: null };
  undoIdea = { career: null, family: null }; undoCleared = { career: null, family: null };
  drafts = { career: '', family: '' }; parkOpen = { career: false, family: false };
  $('idea').value = ''; $('park-panel').open = false;
};
const area = () => state.areas[state.selected];

function save() {
  if (saveBlocked) { renderBanner(); return false; }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    if (saveProblem) { saveProblem = null; say('Saving works again.'); }
  } catch { saveProblem = 'failed'; }
  renderBanner();
  return !saveProblem;
}
let bannerKey = '';
function renderBanner() {
  const b = $('save-banner');
  const k = saveBlocked ? 'blocked' : saveProblem || '';
  if (k === bannerKey) return;
  bannerKey = k;
  if (!k) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  if (k === 'blocked') {
    b.innerHTML = '<p><strong>Your saved data couldn’t be read.</strong> It has been left untouched in this browser, and changes you make now are <strong>not</strong> being saved. Download it to keep a copy, or restore a backup from Data &amp; backup.</p><div class="banner-actions"><button type="button" data-banner="raw">Download the unreadable data</button><button type="button" data-banner="data">Data &amp; backup</button><button type="button" data-banner="fresh">Start fresh…</button></div>';
  } else {
    b.innerHTML = '<p><strong>Couldn’t save to this browser.</strong> ' + (k === 'unavailable' ? 'Browser storage looks disabled (private mode or blocked storage). ' : 'Storage may be full or blocked. ') + 'Your changes exist only in this tab and will be lost if you close or reload it.</p><div class="banner-actions"><button type="button" data-banner="export">Download a backup now</button></div>';
  }
}
$('save-banner').addEventListener('click', e => {
  const b = e.target.closest('[data-banner]');
  if (!b) return;
  if (b.dataset.banner === 'raw') download(unreadableRaw ?? '', 'quiet-studio-unreadable-data.txt', 'text/plain');
  if (b.dataset.banner === 'export') exportData();
  if (b.dataset.banner === 'data') openData();
  if (b.dataset.banner === 'fresh') confirmReplace({ heading: 'Start fresh?', note: 'Your unreadable saved data will be kept as “previous data” so you can still download it. New changes will then save normally.', incoming: blankState(), msg: 'Started fresh. The unreadable data was kept as previous data.' });
});

/* Safety copy taken right before any “replace everything” action. */
function hasContent(st) { return AREAS.some(k => hasGoal(st.areas[k]) || st.areas[k].ideas.length); }
function stashPrevious() {          // returns false only if a copy was needed but couldn't be stored
  const raw = saveBlocked ? unreadableRaw : hasContent(state) ? JSON.stringify(state) : null;
  if (raw === null) return true;      // nothing worth keeping; leave any older safety copy alone
  try { localStorage.setItem(PREV_KEY, JSON.stringify({ savedAt: new Date().toISOString(), raw })); return true; } catch { return false; }
}
function readPrevious() {
  try { const p = JSON.parse(localStorage.getItem(PREV_KEY)); return p && typeof p.raw === 'string' ? p : null; } catch { return null; }
}
function lastExport() { try { return localStorage.getItem(EXPORT_KEY); } catch { return null; } }

window.addEventListener('storage', e => {     // another tab changed the data
  if (e.key !== KEY || e.newValue === null || dlg.open || saveBlocked) return;
  try { state = normalize(JSON.parse(e.newValue)); resetTransient(); render(); say('Updated from another open tab.'); } catch { /* ignore */ }
});

/* ───────────── Small helpers ───────────── */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dlg = $('detail');
let timer;
function say(message, ms = 5500) {
  $('status').textContent = ''; $('dialog-status').textContent = '';
  (dlg.open ? $('dialog-status') : $('status')).textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => { $('status').textContent = ''; $('dialog-status').textContent = ''; }, ms);
}
const quote = s => '“' + s + '”';
const byData = (root, sel, key, val) => [...root.querySelectorAll(sel)].find(x => x.dataset[key] === val) || null;
function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function exportData() {
  const payload = { app: 'quiet-studio', exportedAt: new Date().toISOString(), data: state };
  download(JSON.stringify(payload, null, 2), 'quiet-studio-backup-' + stamp() + '.json', 'application/json');
  try { localStorage.setItem(EXPORT_KEY, new Date().toISOString()); } catch { /* ignore */ }
  say('Backup downloaded. Keep the file somewhere safe.');
}

/* ───────────── Render ───────────── */

function render() {
  const k = state.selected, a = area(), has = hasGoal(a), s = has ? currentStep(a) : null;
  document.querySelectorAll('[data-area]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.area === k)));
  $('mode-label').textContent = state.sample ? 'QUIET STUDIO · SAMPLE DATA' : 'QUIET STUDIO · PERSONAL TRIAL';
  $('goal-section').hidden = $('now-section').hidden = $('path-section').hidden = !has;
  $('empty-area').hidden = has;

  if (!has) {
    $('empty-title').textContent = 'No commitment in ' + LABEL[k] + ' yet.';
    const c = undoCleared[k];
    $('cleared-notice').hidden = !c;
    if (c) $('cleared-text').textContent = 'Commitment ' + quote(c.goal) + ' was cleared.';
  } else {
    $('goal-title').textContent = a.goal; $('goal-title').classList.toggle('long', a.goal.length > 90);
    $('goal-outcome').textContent = 'Achieved when: ' + a.outcome;
    $('daruma-label').textContent = a.achieved ? 'Achieved · both eyes filled' : 'Committed · one eye filled';
    const eyes = a.achieved ? '2' : '1';          // 1 eye = active commitment; 2 only when explicitly marked achieved
    $('goal-daruma').dataset.eyes = eyes;
    $('goal-section').classList.toggle('goal-achieved', a.achieved);
    $('goal-daruma').setAttribute('aria-label', a.achieved ? 'Daruma with both eyes filled: commitment achieved' : 'Daruma with one eye filled: commitment in progress');

    const done = a.steps.filter(x => x.complete).length, open = a.steps.length - done;
    $('step-number').textContent = a.steps.length ? done + ' of ' + a.steps.length + ' steps done' : 'No steps yet';
    const focusable = !!s && !a.achieved;
    let title, why, hint;
    if (a.achieved) { title = 'Commitment achieved.'; why = 'You followed through. Take a moment to enjoy it.'; hint = 'Both eyes filled.'; }
    else if (s) { title = s.title; why = s.why; hint = 'Finish the step. Let the rest wait.'; }
    else if (!a.steps.length) { title = 'Add your first step.'; why = 'One small, concrete step is enough to begin. The route can grow later.'; hint = 'Steps are a route you can adjust, not a promise.'; }
    else if (!open) { title = 'Every step is done.'; why = 'Add another step, or reopen one. The commitment itself is a separate outcome.'; hint = 'If the outcome has happened, use Edit commitment to mark it achieved.'; }
    else { title = 'Choose your next step.'; why = 'Nothing is selected as your current focus. Pick one on purpose; the rest can wait.'; hint = 'Your other steps and notes are untouched.'; }
    $('current-title').textContent = title; $('current-title').classList.toggle('long', title.length > 60);
    $('why').textContent = why; $('why').hidden = !why;
    $('done-label').textContent = focusable ? 'DONE WHEN' : 'COMMITMENT ACHIEVED WHEN';
    $('done-when').textContent = focusable ? s.done : a.outcome;
    $('next-action').value = focusable ? s.action : '';
    $('next-action').hidden = $('next-label').hidden = $('note-panel').hidden = !focusable;
    $('note').value = focusable ? s.note : '';
    $('now-eyebrow').textContent = a.achieved ? 'COMMITMENT COMPLETE' : 'NOW / STAY HERE';
    $('now-section').classList.toggle('is-achieved', a.achieved);
    $('complete').hidden = !focusable;
    $('pick-focus').hidden = !(!s && !a.achieved && open > 0);
    $('add-first').hidden = !(a.steps.length === 0 && !a.achieved);
    $('undo').hidden = !undoDone[k];
    $('focus-hint').textContent = hint;

    $('ladder').innerHTML = a.steps.length ? a.steps.map((x, i) => {
      const cur = x.id === a.active && !x.complete && !a.achieved;
      return '<button type="button" class="rung ' + (x.complete ? 'done' : cur ? 'active' : '') + '" data-step="' + esc(x.id) + '"' + (cur ? ' aria-current="step"' : '') + '><span class="marker" aria-hidden="true">' + (x.complete ? '✓' : cur ? '→' : i + 1) + '</span><span class="sr">' + (x.complete ? 'Completed: ' : cur ? 'Current step: ' : 'Step ' + (i + 1) + ': ') + '</span><span class="rung-title">' + esc(x.title) + '</span>' + (cur ? '<span class="badge" aria-hidden="true">NOW</span>' : '') + '</button>';
    }).join('') : '<p class="muted empty-ladder">No steps yet. Use “Edit ladder” to add the first one.</p>';
    const r = undoRemoved[k];
    $('removed').hidden = !r;
    if (r) $('removed-text').textContent = 'Removed ' + quote(r.step.title) + '.' + (r.wasActive ? ' It was your current step, so no step is selected now.' : ' Your focus is unchanged.');
  }
  $('idea-count').textContent = a.ideas.length;
  $('ideas').innerHTML = a.ideas.map((x, i) => '<li><span class="idea-text">' + esc(x) + '</span><button type="button" class="quiet idea-remove" data-idea="' + i + '" aria-label="Remove parked idea: ' + esc(x) + '">Remove</button></li>').join('');
  const u = undoIdea[k];
  $('idea-undo').hidden = !u;
  if (u) $('idea-undo-text').textContent = 'Removed idea ' + quote(u.text) + '.';
}
function commit() { save(); render(); }

/* ───────────── Dialog plumbing ───────────── */

let opener = null, returnTarget = null;
const describe = el => (!el || el === document.body) ? null : { id: el.id || '', step: el.dataset && el.dataset.step, area: el.dataset && el.dataset.area };
function locate(d) {
  if (!d) return null;
  if (d.id && $(d.id)) return $(d.id);
  if (d.step !== undefined) return byData(document, '#ladder [data-step]', 'step', d.step);
  if (d.area) return byData(document, '[data-area]', 'area', d.area);
  return null;
}
const visible = el => !!el && !el.hidden && el.offsetParent !== null && !el.disabled;
function modal(caption, html, focus) {
  if (!dlg.open) opener = describe(document.activeElement);
  $('dialog-caption').textContent = caption;
  $('dialog-status').textContent = '';
  $('detail-content').innerHTML = html;
  if (!dlg.open) dlg.showModal();
  const root = $('detail-content');
  let target = typeof focus === 'string' ? root.querySelector(focus) : focus;
  target = target || root.querySelector('input:not([type=hidden]):not([type=file]),textarea') || root.querySelector('h2');
  if (target) { if (target.tagName === 'H2') target.tabIndex = -1; target.focus(); }
}
function close() { if (dlg.open) dlg.close(); }
function closeTo(id) { returnTarget = { id }; close(); }
dlg.addEventListener('close', () => {
  $('detail-content').innerHTML = '';
  let t = locate(returnTarget);
  if (!visible(t)) t = locate(opener);
  if (!visible(t)) t = visible($('goal-title')) ? $('goal-title') : $('main');
  if (t && !t.matches('button,input,textarea,summary,a')) t.tabIndex = -1;
  if (t) t.focus();
  returnTarget = opener = null;
});
$('close').onclick = close;
const btn = (label, action, cls = 'quiet', data = {}, aria = '', disabled = false) =>
  '<button type="button" class="' + cls + '" data-action="' + action + '"' + Object.entries(data).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') + (aria ? ' aria-label="' + esc(aria) + '"' : '') + (disabled ? ' disabled' : '') + '>' + label + '</button>';
function field(label, name, value, { multi = false, max = 200, req = false, rows = 3 } = {}) {
  return '<label class="field">' + label + (multi
    ? '<textarea name="' + name + '" rows="' + rows + '" maxlength="' + max + '"' + (req ? ' required' : '') + '>' + esc(value) + '</textarea>'
    : '<input name="' + name + '" maxlength="' + max + '" value="' + esc(value) + '"' + (req ? ' required' : '') + '>') + '</label>';
}
function formError(form, name, msg) {
  let p = form.querySelector('.form-error');
  if (!p) { p = document.createElement('p'); p.className = 'form-error'; p.setAttribute('role', 'alert'); form.querySelector('.dialog-actions').before(p); }
  p.textContent = msg;
  const el = form.elements[name]; if (el) el.focus();
}
const required = (form, f, names) => {      // blocks whitespace-only values that `required` lets through
  for (const [n, label] of names) if (!String(f.get(n)).trim()) { formError(form, n, label + ' can’t be empty.'); return false; }
  return true;
};

const actions = {};   // data-action → handler(dataset)
const forms = {};     // data-form → handler(FormData, formElement)
$('detail-content').addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (b && actions[b.dataset.action]) actions[b.dataset.action](b.dataset, b);
});
$('detail-content').addEventListener('submit', e => {
  e.preventDefault();
  const h = forms[e.target.dataset.form];
  if (h) h(new FormData(e.target), e.target);
});
$('detail-content').addEventListener('change', e => { if (e.target.id === 'import-file') handleImportFile(e.target); });

/* ───────────── Main screen interactions ───────────── */

document.querySelector('.areas').onclick = e => {
  const b = e.target.closest('[data-area]');
  if (!b || b.dataset.area === state.selected) return;
  drafts[state.selected] = $('idea').value; parkOpen[state.selected] = $('park-panel').open;
  state.selected = b.dataset.area;
  $('idea').value = drafts[state.selected]; $('park-panel').open = parkOpen[state.selected]; $('note-panel').open = false;
  commit();
};
$('next-action').oninput = e => { const s = currentStep(area()); if (s) { s.action = e.target.value; save(); } };
$('note').oninput = e => { const s = currentStep(area()); if (s) { s.note = e.target.value; save(); } };

$('complete').onclick = () => {
  const k = state.selected, r = completeCurrent(area());
  if (!r) return;
  undoDone[k] = { id: r.step.id, previousActive: r.step.id };
  commit();
  if (!r.next) $('undo').focus();
  say(r.next ? 'Step finished. Next focus is ready.' : 'Steps finished. Your commitment remains open until its outcome is achieved.');
};
$('undo').onclick = () => {
  const k = state.selected, a = area(), u = undoDone[k];
  if (!u) return;
  const s = findStep(a, u.id);
  undoDone[k] = null;
  if (s) { s.complete = false; a.active = u.previousActive; }
  commit();
  if (visible($('complete'))) $('complete').focus();
  say('Completion undone. Your previous focus is restored.');
};
$('pick-focus').onclick = () => {
  const a = area();
  modal('CHOOSE FOCUS', '<h2>Which step is your focus?</h2><p class="muted">Choosing one makes it your current step. The ladder order stays the same.</p><div class="pick-list">' +
    a.steps.filter(s => !s.complete).map(s => btn(esc(s.title), 'focus', 'pick', { id: s.id })).join('') + '</div>', '.pick');
};
$('add-first').onclick = () => addStepDialog('now');

$('park-form').onsubmit = e => {
  e.preventDefault();
  const value = $('idea').value.trim(), k = state.selected;
  if (!value) return;
  area().ideas.push(value); $('idea').value = ''; drafts[k] = ''; undoIdea[k] = null;
  commit();
  say('Parked in this area. Your focus stays the same.');
};
$('ideas').onclick = e => {
  const b = e.target.closest('[data-idea]');
  if (!b) return;
  const k = state.selected, a = area(), i = +b.dataset.idea;
  const [text] = a.ideas.splice(i, 1);
  undoIdea[k] = { text, index: i };
  commit();
  ($('ideas').querySelectorAll('.idea-remove')[Math.min(i, a.ideas.length - 1)] || $('idea')).focus();
  say('Idea removed. You can undo this.');
};
$('undo-idea').onclick = () => {
  const k = state.selected, a = area(), u = undoIdea[k];
  if (!u) return;
  a.ideas.splice(Math.min(u.index, a.ideas.length), 0, u.text); undoIdea[k] = null;
  commit();
  ($('ideas').querySelectorAll('.idea-remove')[u.index] || $('idea')).focus();
  say('Idea restored.');
};
$('ladder').onclick = e => { const b = e.target.closest('[data-step]'); if (b) showStep(b.dataset.step); };
$('undo-remove').onclick = () => {
  const k = state.selected, a = area(), r = undoRemoved[k];
  if (!r) return;
  undoRemoved[k] = null;
  const focusBack = restoreStepTo(a, r);
  commit();
  const row = byData(document, '#ladder [data-step]', 'step', r.step.id); if (row) row.focus();
  say(focusBack ? 'Step restored as your current focus.' : 'Step restored. Your focus is unchanged.');
};
$('dismiss-removed').onclick = () => { undoRemoved[state.selected] = null; render(); $('edit').focus(); };

/* ───────────── Step details, focus, completion state ───────────── */

function showStep(id) {
  const a = area(), s = findStep(a, id);
  if (!s) { close(); return; }
  const isCur = a.active === id && !s.complete;
  const stateCls = s.complete ? 'is-done' : isCur ? 'is-focus' : '';
  modal('STEP DETAILS',
    '<p class="detail-state ' + stateCls + '">' + (s.complete ? 'Completed' : isCur ? 'Your current focus' : 'Available when you need it') + '</p><h2>' + esc(s.title) + '</h2>' +
    '<h3>WHY</h3><p class="prose">' + esc(s.why || 'No extra explanation needed.') + '</p>' +
    '<h3>DONE WHEN</h3><p class="prose">' + esc(s.done || 'Not written yet.') + '</p>' +
    '<h3>NEXT ACTION</h3><p class="prose">' + esc(s.action || 'No next action yet.') + '</p>' +
    '<h3>NOTE</h3><p class="prose">' + esc(s.note || 'No notes yet.') + '</p>' +
    '<div class="dialog-actions">' + (s.complete ? btn('Mark unfinished', 'reopen', 'primary', { id }) : !isCur && !a.achieved ? btn('Make current focus', 'focus', 'primary', { id }) : '') + btn('Edit step', 'edit-step', 'quiet', { id }) + '</div>');
}
actions['show-step'] = d => showStep(d.id);
actions.reopen = d => {            // reopening never moves focus
  const k = state.selected, s = findStep(area(), d.id);
  if (!s) return;
  s.complete = false;
  if (undoDone[k] && undoDone[k].id === d.id) undoDone[k] = null;
  commit(); showStep(d.id);
  say('Marked unfinished. Your current focus has not changed.');
};
function applyFocus(id) {
  const a = area();
  a.active = id; undoDone[state.selected] = null;
  commit(); closeTo('complete'); say('Focus changed deliberately. Your other steps are saved.');
}
actions.focus = d => {
  const a = area(), s = findStep(a, d.id), old = currentStep(a);
  if (!s || s.complete) return;
  if (!old || old.id === s.id) { applyFocus(d.id); return; }
  modal('CHANGE FOCUS', '<h2>Make this your focus?</h2><p>Switch from ' + esc(quote(old.title)) + ' to ' + esc(quote(s.title)) + '?</p><p class="muted">Your progress and notes will be kept. The ladder order stays the same.</p><div class="dialog-actions">' + btn('Switch focus', 'apply-focus', 'primary', { id: d.id }) + btn('Keep current focus', 'show-step', 'quiet', { id: d.id }) + '</div>');
};
actions['apply-focus'] = d => applyFocus(d.id);

/* ───────────── Editing steps ───────────── */

function editStep(id) {
  const s = findStep(area(), id);
  if (!s) return;
  modal('EDIT STEP', '<h2>Keep it concrete.</h2><form data-form="step" data-id="' + esc(id) + '">' +
    field('Step', 'title', s.title, { req: true }) + field('Why (optional)', 'why', s.why, { multi: true, max: 1500 }) +
    field('Done when', 'done', s.done, { multi: true, max: 500, req: true, rows: 2 }) + field('Next action (optional)', 'action', s.action, { multi: true, max: 1500, rows: 2 }) +
    field('Note (optional)', 'note', s.note, { multi: true, max: 1500 }) +
    '<div class="dialog-actions"><button class="primary">Save step</button>' + btn('Cancel', 'show-step', 'quiet', { id }) + btn('Remove step', 'remove-step', 'quiet danger push', { id, from: 'detail' }) + '</div></form>', 'input[name=title]');
}
actions['edit-step'] = d => editStep(d.id);
forms.step = (f, form) => {
  const s = findStep(area(), form.dataset.id);
  if (!s) { close(); return; }
  if (!required(form, f, [['title', 'The step'], ['done', '“Done when”']])) return;
  for (const k of ['title', 'why', 'done', 'action', 'note']) s[k] = String(f.get(k)).trim();
  commit(); showStep(s.id); say('Step saved.');
};

function addStepDialog(from) {
  const a = area(), cur = currentStep(a);
  modal('ADD STEP', '<h2>One useful next step.</h2><form data-form="add" data-from="' + from + '">' +
    field('Step', 'title', '', { req: true }) + field('Why (optional)', 'why', '', { multi: true, max: 1500, rows: 2 }) + field('Done when', 'done', '', { multi: true, max: 500, req: true, rows: 2 }) +
    field('Next action (optional)', 'action', '', { multi: true, max: 1500, rows: 2 }) +
    (a.achieved ? '' : '<label class="check"><input type="checkbox" name="focus"' + (cur ? '' : ' checked') + '><span>' + (cur ? 'Make this my current focus instead of ' + esc(quote(cur.title)) : 'Make this my current focus') + '</span></label>') +
    '<div class="dialog-actions"><button class="primary">Add to ladder</button>' + btn('Cancel', from === 'now' ? 'close' : 'editor', 'quiet') + '</div></form>', 'input[name=title]');
}
actions.close = close;
forms.add = (f, form) => {
  const k = state.selected, a = area();
  if (!required(form, f, [['title', 'The step'], ['done', '“Done when”']])) return;
  const id = newId(a), title = String(f.get('title')).trim();
  a.steps.push(makeStep(id, title, String(f.get('why')).trim(), String(f.get('done')).trim(), String(f.get('action')).trim()));
  const focused = !!f.get('focus') && !a.achieved;
  if (focused) { a.active = id; undoDone[k] = null; }
  commit();
  if (form.dataset.from === 'now') closeTo(focused ? 'complete' : 'edit'); else editor({ add: true });
  say(focused ? 'Step added and set as your current focus.' : 'Step added at the end. Your focus has not changed.');
};

function editor(focus = {}) {
  const a = area(), last = a.steps.length - 1;
  modal('EDIT LADDER', '<h2>A route you can adjust.</h2><p class="muted">Reordering never changes your current focus. Open a step from the ladder to choose it deliberately.</p><ol class="editor-list">' +
    a.steps.map((s, i) => '<li class="edit-row"><span class="rung-title">' + (i + 1) + '. ' + esc(s.title) + (s.complete ? ' <em class="tag done">done</em>' : a.active === s.id ? ' <em class="tag current">current</em>' : '') + '</span><span class="row-actions">' +
      btn('Edit', 'edit-step', '', { id: s.id }, 'Edit ' + quote(s.title)) +
      btn('↑', 'move', '', { id: s.id, dir: -1 }, 'Move ' + quote(s.title) + ' up', i === 0) +
      btn('↓', 'move', '', { id: s.id, dir: 1 }, 'Move ' + quote(s.title) + ' down', i === last) +
      btn('Remove', 'remove-step', 'danger', { id: s.id, from: 'editor' }, 'Remove ' + quote(s.title)) + '</span></li>').join('') +
    '</ol>' + (a.steps.length ? '' : '<p class="muted">No steps yet.</p>') + '<div class="dialog-actions">' + btn('+ Add a step', 'add-step', 'primary') + btn('Done', 'close', 'quiet') + '</div>', 'h2');
  const root = $('detail-content');
  let t = null;
  if (focus.move) {   // keep keyboard position on the step that was moved
    const both = [...root.querySelectorAll('[data-action=move]')].filter(x => x.dataset.id === focus.move.id);
    t = both.find(x => +x.dataset.dir === focus.move.dir && !x.disabled) || both.find(x => !x.disabled) || null;
  } else if (focus.row !== undefined) {
    const rows = root.querySelectorAll('.edit-row');
    t = rows.length ? rows[Math.min(focus.row, rows.length - 1)].querySelector('button') : null;
  }
  if (focus.add || (!t && (focus.row !== undefined || focus.move))) t = root.querySelector('[data-action=add-step]');
  if (t) t.focus();
}
$('edit').onclick = () => editor();
actions.editor = () => editor();
actions['add-step'] = () => addStepDialog('editor');
actions.move = d => {
  const a = area(), j = moveStep(a, d.id, +d.dir), s = findStep(a, d.id);
  if (j < 0) return;
  commit(); editor({ move: { id: d.id, dir: +d.dir } });
  say('Moved ' + quote(s.title) + ' to position ' + (j + 1) + ' of ' + a.steps.length + '. Your current focus has not changed.');
};

/* Removing steps (with Undo; removing the current step clears the focus on purpose) */
function doRemove(id, from) {
  const k = state.selected, a = area(), idx = a.steps.findIndex(s => s.id === id);
  const rec = removeStepFrom(a, id);
  if (!rec) return;
  undoRemoved[k] = rec;
  if (undoDone[k] && undoDone[k].id === id) undoDone[k] = null;
  commit();
  if (from === 'editor') editor({ row: idx }); else closeTo('edit');
  say(rec.wasActive ? 'Removed your current step ' + quote(rec.step.title) + '. No step is selected now. You can undo this.' : 'Removed ' + quote(rec.step.title) + '. Your focus is unchanged. You can undo this.');
}
actions['remove-step'] = d => {
  const a = area(), s = findStep(a, d.id);
  if (!s) return;
  if (a.active === d.id && !s.complete) {
    modal('REMOVE CURRENT STEP', '<h2>Remove your current step?</h2><p>' + esc(quote(s.title)) + ' is your current focus.</p><p class="muted">If you remove it, no step will be selected until you choose one. Nothing else changes, and you can undo the removal afterwards.</p><div class="dialog-actions">' +
      btn('Remove step', 'confirm-remove', 'primary', { id: d.id, from: d.from }) + btn('Keep it', d.from === 'editor' ? 'editor' : 'edit-step', 'quiet', { id: d.id }) + '</div>');
    return;
  }
  doRemove(d.id, d.from);
};
actions['confirm-remove'] = d => doRemove(d.id, d.from);

/* ───────────── Commitment ───────────── */

function goalDialog() {
  const a = area(), has = hasGoal(a);
  modal(has ? 'DARUMA COMMITMENT' : 'NEW COMMITMENT', '<h2>' + (has ? 'What are you committing to?' : 'What will you commit to in ' + esc(LABEL[state.selected]) + '?') + '</h2><form data-form="goal" data-mode="' + (has ? 'edit' : 'create') + '">' +
    field('My commitment', 'goal', a.goal, { req: true }) + field('Achieved when', 'outcome', a.outcome, { multi: true, max: 500, req: true, rows: 2 }) +
    '<p class="form-note">' + (has ? 'Changing the wording keeps your steps and progress. The second eye is filled only when you mark this outcome achieved.' : 'One commitment per area. You can add steps afterwards.') + '</p>' +
    '<div class="dialog-actions"><button class="primary">' + (has ? 'Save commitment' : 'Create commitment') + '</button>' +
    (has ? btn(a.achieved ? 'Reopen commitment' : 'Mark commitment achieved', 'goal-state') + btn('Clear commitment…', 'clear-goal', 'quiet danger push') : btn('Cancel', 'close')) + '</div></form>', 'input[name=goal]');
}
$('edit-goal').onclick = goalDialog;
$('create-goal').onclick = goalDialog;
forms.goal = (f, form) => {
  const k = state.selected, a = area(), creating = form.dataset.mode === 'create';
  if (!required(form, f, [['goal', 'The commitment'], ['outcome', '“Achieved when”']])) return;
  a.goal = String(f.get('goal')).trim(); a.outcome = String(f.get('outcome')).trim();
  state.sample = false;
  if (creating) { undoCleared[k] = null; a.achieved = false; }
  commit();
  closeTo(creating ? 'add-first' : 'edit-goal');
  say(creating ? 'Commitment created. Add a first step when you are ready.' : 'Commitment updated. Your steps and progress are kept.');
};
actions['goal-state'] = () => {
  const k = state.selected, a = area();
  if (a.achieved) { a.achieved = false; commit(); close(); say('Commitment reopened.'); return; }
  modal('COMPLETE COMMITMENT', '<h2>Has this outcome happened?</h2><p class="prose">' + esc(a.outcome) + '</p><p class="muted">This fills the second eye. It doesn’t mark unfinished steps as done.</p><div class="dialog-actions">' + btn('Yes, mark achieved', 'confirm-goal', 'primary') + btn('Not yet', 'close') + '</div>');
};
actions['confirm-goal'] = () => { const k = state.selected; area().achieved = true; undoDone[k] = null; commit(); close(); say('Commitment achieved. Both eyes filled.'); };
actions['clear-goal'] = () => {
  const a = area();
  modal('CLEAR COMMITMENT', '<h2>Clear this commitment?</h2><p class="prose">' + esc(a.goal) + '</p><p class="muted">This empties the ' + esc(LABEL[state.selected]) + ' area: the commitment and its ' + a.steps.length + ' step' + (a.steps.length === 1 ? '' : 's') + ' are removed. Parked ideas stay. The other area is not affected. You can undo this right afterwards.</p><div class="dialog-actions">' + btn('Clear commitment', 'confirm-clear', 'primary') + btn('Keep it', 'edit-goal-back') + '</div>');
};
actions['edit-goal-back'] = goalDialog;
actions['confirm-clear'] = () => {
  const k = state.selected, a = area();
  undoCleared[k] = { goal: a.goal, outcome: a.outcome, achieved: a.achieved, active: a.active, steps: clone(a.steps) };
  Object.assign(a, { goal: '', outcome: '', achieved: false, active: null, steps: [] });
  undoDone[k] = null; undoRemoved[k] = null;
  commit(); closeTo('create-goal'); say('Commitment cleared. You can undo this below.');
};
$('undo-clear').onclick = () => {
  const k = state.selected, a = area(), c = undoCleared[k];
  if (!c || hasGoal(a)) return;
  Object.assign(a, clone(c)); undoCleared[k] = null;
  commit(); $('edit-goal').focus(); say('Commitment restored.');
};

/* ───────────── Data & backup ───────────── */

function summaryHtml(st) {
  if (!st) return '<p class="muted">Unreadable data.</p>';
  return '<ul class="summary">' + AREAS.map(k => {
    const a = st.areas[k], n = a.ideas.length + ' parked idea' + (a.ideas.length === 1 ? '' : 's');
    return '<li><strong>' + LABEL[k] + '</strong> — ' + (hasGoal(a) ? esc(quote(a.goal)) + ' · ' + a.steps.filter(s => s.complete).length + ' of ' + a.steps.length + ' steps done · ' + n : 'no commitment · ' + n) + '</li>';
  }).join('') + '</ul>';
}
function openData(error) {
  const prev = readPrevious(), le = lastExport();
  let prevInfo = '';
  if (prev) {
    let sum; try { sum = summaryHtml(normalize(JSON.parse(prev.raw))); } catch { sum = '<p class="muted">This copy can’t be read by the app, but you can still download it.</p>'; }
    prevInfo = '<h3>PREVIOUS DATA</h3><p class="muted">A copy kept from ' + esc(new Date(prev.savedAt).toLocaleString()) + ', just before your last replace. Only one copy is kept.</p>' + sum + '<div class="dialog-actions">' + btn('Download it', 'dl-prev', 'ghost') + btn('Restore it…', 'restore-prev', 'ghost') + '</div>';
  }
  modal('DATA & BACKUP', '<h2>Your data</h2>' +
    '<p class="muted">Saved only in this browser, under <strong class="origin">' + esc(location.origin === 'null' ? 'this file (file://)' : location.origin) + '</strong>. It doesn’t sync to other devices, and using a different address or browser shows different (or empty) data.</p>' +
    '<h3>BACK UP</h3><p class="muted">' + (le ? 'Last backup downloaded: ' + esc(new Date(le).toLocaleString()) + '.' : 'You haven’t downloaded a backup yet.') + '</p><div class="dialog-actions">' + btn('Download backup (JSON)', 'export', 'primary') + '</div>' +
    '<h3>RESTORE FROM A BACKUP FILE</h3><p class="muted">You’ll see what the file contains and confirm before anything is replaced.</p>' + (error ? '<p class="form-error" role="alert" tabindex="-1">' + esc(error) + '</p>' : '') +
    '<div class="dialog-actions">' + btn('Choose backup file…', 'pick-file', 'ghost') + '<input type="file" id="import-file" accept=".json,application/json" hidden aria-label="Backup file"></div>' + prevInfo +
    '<details class="danger-zone"><summary>Sample data and reset</summary><p class="muted">Sample data is never loaded for you. These actions replace everything in this browser, after you confirm.</p><div class="dialog-actions">' + btn('Load sample data…', 'load-sample', 'ghost') + btn('Erase everything…', 'load-empty', 'ghost danger') + '</div></details>',
    error ? '[role=alert]' : 'h2');
}
$('data').onclick = () => openData();
actions.export = exportData;
actions['pick-file'] = () => $('import-file').click();
actions['dl-prev'] = () => { const p = readPrevious(); if (p) download(p.raw, 'quiet-studio-previous-data-' + stamp() + '.json', 'application/json'); };
actions['load-sample'] = () => confirmReplace({ heading: 'Load the sample data?', note: 'This fills both areas with sample commitments, steps and ideas, replacing what is there now.', incoming: sampleState(), msg: 'Sample data loaded.' });
actions['load-empty'] = () => confirmReplace({ heading: 'Erase everything?', note: 'Both areas become empty, including parked ideas.', incoming: blankState(), msg: 'Everything erased. Both areas are empty.' });
actions['restore-prev'] = () => {
  const p = readPrevious();
  try { confirmReplace({ heading: 'Restore your previous data?', note: 'This swaps the previous copy back in. What is in the app now becomes the new “previous data”.', incoming: normalize(JSON.parse(p.raw)), msg: 'Previous data restored.' }); }
  catch (e) { openData('The previous copy can’t be read by the app: ' + (e.user ? e.message : 'invalid data') + ' Download it instead.'); }
};
async function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    if (file.size > LIMIT.file) bad('That file is too large (over ' + Math.round(LIMIT.file / 1e6) + ' MB) to be a Quiet Studio backup.');
    const incoming = parseBackup(await file.text());
    confirmReplace({ heading: 'Replace your data with this backup?', note: 'File: ' + esc(file.name) + '.', incoming, msg: 'Backup restored.' });
  } catch (e) {
    openData(e.user ? e.message : 'That file couldn’t be read. Nothing was changed.');
  }
}
let pending = null;
function confirmReplace({ heading, note, incoming, msg }) {
  pending = { incoming, msg };
  modal('CONFIRM REPLACE', '<h2>' + esc(heading) + '</h2><p>' + note + '</p><h3>IN THIS BROWSER NOW</h3>' + summaryHtml(saveBlocked ? null : state) +
    '<h3>WOULD REPLACE IT WITH</h3>' + summaryHtml(incoming) +
    (saveBlocked || hasContent(state) ? '<p class="muted">Your current data is first kept as “previous data” (Data &amp; backup). Download a backup now if you want your own copy.</p>' : '') + '<div class="dialog-actions">' +
    btn('Replace my data', 'confirm-replace', 'primary') + btn('Download current data first', 'export', 'quiet') + btn('Cancel', 'cancel-replace', 'quiet') + '</div>', '[data-action=cancel-replace]');
}
actions['cancel-replace'] = () => { pending = null; openData(); };
actions['confirm-replace'] = () => {
  if (!pending) return;
  const { incoming, msg } = pending; pending = null;
  const kept = stashPrevious();
  state = incoming; saveBlocked = false; unreadableRaw = null; resetTransient();
  commit(); closeTo('data');
  say(msg + (kept ? '' : ' (A safety copy of the previous data could not be kept.)'), 8000);
};

/* ───────────── Start ───────────── */
render();
renderBanner();
if (saveBlocked) say('Saved data could not be read. It was left untouched.', 8000);
