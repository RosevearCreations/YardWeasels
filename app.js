/* =========================
   CONFIG
========================= */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';
const SUPABASE_ANON_KEY = ''; // leave '' if your function is public (Verify JWT OFF)
const OUTBOX_KEY = 'ywi_outbox_v1';

/* =========================
   HELPERS
========================= */
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ensureTBody(tableId) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return null;
  let tb = tbl.querySelector('tbody');
  if (!tb) { tb = document.createElement('tbody'); tbl.appendChild(tb); }
  return tb;
}

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}
function setOutbox(list) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

async function sendToFunction(formType, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ formType, payload })
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Function error', res.status, text);
    throw new Error(text || `HTTP ${res.status}`);
  }
  try { return JSON.parse(text); } catch { return { ok: true }; }
}

async function flushOutbox() {
  const outbox = getOutbox();
  if (!outbox.length) { alert('Outbox is empty.'); return; }
  const remaining = [];
  for (const item of outbox) {
    try { await sendToFunction(item.formType, item.payload); }
    catch { remaining.push(item); }
  }
  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}
document.querySelectorAll('[data-role="retry-outbox"]').forEach(btn =>
  btn.addEventListener('click', flushOutbox)
);

/* =========================
   TOOLBOX TALK (E)
========================= */
const tbForm = document.getElementById('toolboxForm');
const tbDate = document.getElementById('tb_date');
if (tbDate) tbDate.value = todayISO();

const attendeesTableBody = ensureTBody('attendeesTable');
const addRowBtn = document.getElementById('addRowBtn');

let tbRowCount = 0;
const sigPads = new Map(); // rowId -> SignaturePad
function addAttendeeRow(initialName = '', initialRole = 'worker') {
  if (!attendeesTableBody) return;
  tbRowCount++;
  const id = `row_${tbRowCount}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type="text" class="att-name" placeholder="Full name" value="${initialName}" required></td>
    <td>
      <select class="att-role">
        <option value="worker" ${initialRole==='worker'?'selected':''}>Worker</option>
        <option value="foreman" ${initialRole==='foreman'?'selected':''}>Foreman</option>
        <option value="supervisor" ${initialRole==='supervisor'?'selected':''}>Supervisor</option>
        <option value="visitor" ${initialRole==='visitor'?'selected':''}>Visitor</option>
      </select>
    </td>
    <td>
      <div class="canvas-wrap">
        <canvas id="${id}_canvas" width="600" height="140"></canvas>
        <div class="controls"><button type="button" data-act="clear">Clear</button></div>
      </div>
    </td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  attendeesTableBody.appendChild(tr);

  // Optional signatures if SignaturePad is loaded via CDN
  const canvas = tr.querySelector('canvas');
  if (window.SignaturePad && canvas) {
    try {
      // eslint-disable-next-line no-undef
      const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
      sigPads.set(id, pad);
    } catch (e) {
      console.warn('SignaturePad init failed:', e);
    }
  }
}

if (addRowBtn) addRowBtn.addEventListener('click', () => addAttendeeRow());
if (attendeesTableBody) {
  attendeesTableBody.addEventListener('click', (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
    if (!btn) return;
    const tr = btn.closest('tr');
    const rowId = tr ? tr.dataset.rowId : null;
    const act = btn.dataset.act;
    if (act === 'remove' && tr) { if (rowId) sigPads.delete(rowId); tr.remove(); }
    if (act === 'clear' && rowId) { const pad = sigPads.get(rowId); if (pad && pad.clear) pad.clear(); }
  });

  // default two rows
  addAttendeeRow();
  addAttendeeRow();
}

if (tbForm) tbForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site   = (document.getElementById('tb_site')   || {}).value?.trim?.() || '';
  const date   = (document.getElementById('tb_date')   || {}).value || '';
  const leader = (document.getElementById('tb_leader') || {}).value?.trim?.() || '';
  const notes  = (document.getElementById('tb_topics') || {}).value?.trim?.() || '';

  if (!site || !date || !leader) { alert('Please fill Site, Date, and Discussion Leader.'); return; }

  const rows = attendeesTableBody ? Array.from(attendeesTableBody.querySelectorAll('tr')) : [];
  const attendees = rows.map(tr => {
    const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.att-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? sigPads.get(rowId) : null;
    const signed = pad && typeof pad.isEmpty === 'function' ? !pad.isEmpty() : false;
    return { name, role_on_site: role, signature_png: signed && pad.toDataURL ? pad.toDataURL('image/png') : null };
  }).filter(a => a.name);

  const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };

  try {
    await sendToFunction('E', payload);
    alert('Toolbox submitted. Email sent.');
    tbForm.reset();
    if (attendeesTableBody) { attendeesTableBody.innerHTML = ''; sigPads.clear(); addAttendeeRow(); addAttendeeRow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'E', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   PPE CHECK (D)
========================= */
const ppeForm = document.getElementById('ppeForm');
const ppeDate = document.getElementById('ppe_date');
if (ppeDate) ppeDate.value = todayISO();

const ppeTableBody = ensureTBody('ppeTable');
const ppeAddRowBtn = document.getElementById('ppeAddRowBtn');

function ppeRowTemplate() {
  return `
    <td><input type="text" class="ppe-name" placeholder="Full name" required></td>
    <td>
      <select class="ppe-role">
        <option value="worker">Worker</option>
        <option value="foreman">Foreman</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><input type="checkbox" class="ppe-shoes"   checked></td>
    <td><input type="checkbox" class="ppe-vest"    checked></td>
    <td><input type="checkbox" class="ppe-plugs"   checked></td>
    <td><input type="checkbox" class="ppe-goggles" checked></td>
    <td><input type="checkbox" class="ppe-muffs"   checked></td>
    <td><input type="checkbox" class="ppe-gloves"  checked></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
}
function addPPERow() {
  if (!ppeTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = ppeRowTemplate();
  ppeTableBody.appendChild(tr);
}

if (ppeAddRowBtn) ppeAddRowBtn.addEventListener('click', addPPERow);
if (ppeTableBody) { addPPERow(); addPPERow(); }
if (ppeTableBody) ppeTableBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
  }
});

if (ppeForm) ppeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site    = (document.getElementById('ppe_site')    || {}).value?.trim?.() || '';
  const date    = (document.getElementById('ppe_date')    || {}).value || '';
  const checker = (document.getElementById('ppe_checker') || {}).value?.trim?.() || '';
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }

  const rows = ppeTableBody ? Array.from(ppeTableBody.querySelectorAll('tr')) : [];
  const roster = rows.map(tr => ({
    name: tr.querySelector('.ppe-name')?.value?.trim?.() || '',
    role_on_site: tr.querySelector('.ppe-role')?.value || 'worker',
    items: {
      shoes:   !!tr.querySelector('.ppe-shoes')?.checked,
      vest:    !!tr.querySelector('.ppe-vest')?.checked,
      plugs:   !!tr.querySelector('.ppe-plugs')?.checked,
      goggles: !!tr.querySelector('.ppe-goggles')?.checked,
      muffs:   !!tr.querySelector('.ppe-muffs')?.checked,
      gloves:  !!tr.querySelector('.ppe-gloves')?.checked,
    }
  })).filter(r => r.name);

  const nonCompliant = roster.some(r =>
    !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves
  );

  const payload = { site, date, checked_by: checker, roster, nonCompliant };

  try {
    const resp = await sendToFunction('D', payload);
    alert(resp && resp.emailed ? 'Submitted. Non-compliance emailed.' : 'Submitted.');
    ppeForm.reset();
    if (ppeTableBody) { ppeTableBody.innerHTML = ''; addPPERow(); addPPERow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'D', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FIRST AID KIT (B)
========================= */
const faForm = document.getElementById('faForm');
const faDate = document.getElementById('fa_date');
if (faDate) faDate.value = todayISO();

const faTableBody = ensureTBody('faTable');
const faAddRowBtn = document.getElementById('faAddRowBtn');

function addItemRow() {
  if (!faTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="fa-name" placeholder="e.g., Bandages" required></td>
    <td><input type="number" class="fa-qty" min="0" value="0"></td>
    <td><input type="number" class="fa-min" min="0" value="0"></td>
    <td><input type="date" class="fa-exp"></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  faTableBody.appendChild(tr);
}
if (faAddRowBtn) faAddRowBtn.addEventListener('click', addItemRow);
if (faTableBody) { addItemRow(); addItemRow(); }
if (faTableBody) faTableBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
  }
});

function within30Days(iso) {
  if (!iso) return false;
  const now = new Date();
  const d = new Date(iso);
  const diffDays = (d.getTime() - now.getTime()) / 86400000;
  return diffDays <= 30;
}

if (faForm) faForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site    = (document.getElementById('fa_site')    || {}).value?.trim?.() || '';
  const date    = (document.getElementById('fa_date')    || {}).value || '';
  const checker = (document.getElementById('fa_checker') || {}).value?.trim?.() || '';
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }

  const rows = faTableBody ? Array.from(faTableBody.querySelectorAll('tr')) : [];
  const items = rows.map(tr => {
    const name = tr.querySelector('.fa-name')?.value?.trim?.() || '';
    const qty  = parseInt(tr.querySelector('.fa-qty')?.value || '0', 10);
    const min  = parseInt(tr.querySelector('.fa-min')?.value || '0', 10);
    const exp  = tr.querySelector('.fa-exp')?.value || null;
    return { name, quantity: qty, min, expiry: exp };
  }).filter(i => i.name);

  const flagged = items.some(i =>
    (i.quantity <= (i.min || 0)) ||
    (i.expiry && (within30Days(i.expiry) || (new Date(i.expiry) < new Date())))
  );

  const payload = { site, date, checked_by: checker, items, flagged };

  try {
    const resp = await sendToFunction('B', payload);
    alert(resp && resp.emailed ? 'Submitted. Restock/expiry emailed.' : 'Submitted.');
    faForm.reset();
    if (faTableBody) { faTableBody.innerHTML = ''; addItemRow(); addItemRow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'B', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});
