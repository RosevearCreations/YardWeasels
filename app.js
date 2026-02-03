/* CONFIG: replace with your deployed function URL */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';
const OUTBOX_KEY = 'ywi_outbox_v1';

// ===== Toolbox Talk (E) =====
const attendeesTable = document.getElementById('attendeesTable')?.querySelector('tbody');
const addRowBtn = document.getElementById('addRowBtn');
const tbForm = document.getElementById('toolboxForm');
const tbDate = document.getElementById('tb_date');

// ===== PPE Check (D) =====
const ppeTableBody = document.getElementById('ppeTable')?.querySelector('tbody');
const ppeAddRowBtn = document.getElementById('ppeAddRowBtn');
const ppeForm = document.getElementById('ppeForm');
const ppeDate = document.getElementById('ppe_date');

// ===== First Aid (B) =====
const faTableBody = document.getElementById('faTable')?.querySelector('tbody');
const faAddRowBtn = document.getElementById('faAddRowBtn');
const faForm = document.getElementById('faForm');
const faDate = document.getElementById('fa_date');

// Default today date for any date inputs present
(function setTodayDates(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  if (tbDate) tbDate.value = `${yyyy}-${mm}-${dd}`;
  if (ppeDate) ppeDate.value = `${yyyy}-${mm}-${dd}`;
  if (faDate) faDate.value = `${yyyy}-${mm}-${dd}`;
})();

// ---- Outbox helpers ----
function getOutbox(){ try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } }
function setOutbox(list){ localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }

async function sendToFunction(formType, payload){
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formType, payload })
  });
  const text = await res.text();
  if (!res.ok) { console.error('Function error', res.status, text); throw new Error(text || `HTTP ${res.status}`); }
  try { return JSON.parse(text); } catch { return { ok: true }; }
}

async function flushOutbox(){
  const outbox = getOutbox();
  if (!outbox.length) { alert('Outbox is empty.'); return; }
  const remaining = [];
  for (const item of outbox){
    try { await sendToFunction(item.formType, item.payload); }
    catch(e){ remaining.push(item); }
  }
  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}

Array.from(document.querySelectorAll('[data-role="retry-outbox"]')).forEach(btn => btn.addEventListener('click', flushOutbox));

// ===== Toolbox Talk (E) UI logic =====
let tbRowCount = 0; const sigPads = new Map();
function addAttendeeRow(initialName = '', initialRole = '') {
  if (!attendeesTable) return;
  tbRowCount++;
  const id = `row_${tbRowCount}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type=\"text\" class=\"att-name\" placeholder=\"Full name\" value=\"${initialName}\" required></td>
    <td>
      <select class=\"att-role\">
        <option value=\"worker\" ${initialRole==='worker'?'selected':''}>Worker</option>
        <option value=\"foreman\" ${initialRole==='foreman'?'selected':''}>Foreman</option>
        <option value=\"supervisor\" ${initialRole==='supervisor'?'selected':''}>Supervisor</option>
        <option value=\"visitor\" ${initialRole==='visitor'?'selected':''}>Visitor</option>
      </select>
    </td>
    <td>
      <div class=\"canvas-wrap\">
        <canvas id=\"${id}_canvas\" width=\"600\" height=\"140\"></canvas>
        <div class=\"controls\"><button type=\"button\" data-act=\"clear\">Clear</button></div>
      </div>
    </td>
    <td><div class=\"controls\"><button type=\"button\" data-act=\"remove\">Remove</button></div></td>`;
  attendeesTable.appendChild(tr);
  const canvas = tr.querySelector('canvas');
  // @ts-ignore
  const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
  sigPads.set(id, pad);
}
if (addRowBtn) addRowBtn.addEventListener('click', () => addAttendeeRow());
if (attendeesTable) attendeesTable.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button'); if (!btn) return;
  const tr = (e.target as HTMLElement).closest('tr'); const rowId = (tr as HTMLElement).dataset.rowId!; const act = (btn as HTMLElement).dataset.act;
  if (act === 'remove') { sigPads.delete(rowId); (tr as HTMLElement).remove(); }
  else if (act === 'clear') { sigPads.get(rowId)?.clear(); }
});
if (attendeesTable) { addAttendeeRow(); addAttendeeRow(); }

if (tbForm) tbForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = (document.getElementById('tb_site') as HTMLInputElement).value.trim();
  const date = (document.getElementById('tb_date') as HTMLInputElement).value;
  const leader = (document.getElementById('tb_leader') as HTMLInputElement).value.trim();
  const notes = (document.getElementById('tb_topics') as HTMLTextAreaElement).value.trim();
  if (!site || !date || !leader) { alert('Please fill Site, Date, and Discussion Leader.'); return; }
  const attendees = [...attendeesTable!.querySelectorAll('tr')].map(tr => {
    const name = (tr.querySelector('.att-name') as HTMLInputElement).value.trim();
    const role = (tr.querySelector('.att-role') as HTMLSelectElement).value;
    const pad = sigPads.get((tr as HTMLElement).dataset.rowId!); const signed = pad && !pad.isEmpty();
    return { name, role_on_site: role, signature_png: signed ? pad.toDataURL('image/png') : null };
  }).filter(a => a.name);
  const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };
  try { await sendToFunction('E', payload); alert('Toolbox submitted. Email sent.'); tbForm.reset(); attendeesTable!.innerHTML=''; sigPads.clear(); addAttendeeRow(); addAttendeeRow(); }
  catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'E', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});

// ===== PPE (D) UI logic =====
let ppeRowCount = 0;
function ppeRowTemplate(id){
  return `
    <td><input type=\"text\" class=\"ppe-name\" placeholder=\"Full name\" required></td>
    <td>
      <select class=\"ppe-role\">
        <option value=\"worker\">Worker</option>
        <option value=\"foreman\">Foreman</option>
        <option value=\"supervisor\">Supervisor</option>
        <option value=\"visitor\">Visitor</option>
      </select>
    </td>
    <td><input type=\"checkbox\" class=\"ppe-shoes\" checked></td>
    <td><input type=\"checkbox\" class=\"ppe-vest\" checked></td>
    <td><input type=\"checkbox\" class=\"ppe-plugs\" checked></td>
    <td><input type=\"checkbox\" class=\"ppe-goggles\" checked></td>
    <td><input type=\"checkbox\" class=\"ppe-muffs\" checked></td>
    <td><input type=\"checkbox\" class=\"ppe-gloves\" checked></td>
    <td><div class=\"controls\"><button type=\"button\" data-act=\"remove\">Remove</button></div></td>`;
}
function addPPERow(){ if (!ppeTableBody) return; ppeRowCount++; const id = `pr_${ppeRowCount}`; const tr = document.createElement('tr'); tr.dataset.rowId = id; tr.innerHTML = ppeRowTemplate(id); ppeTableBody.appendChild(tr); }
if (ppeAddRowBtn) ppeAddRowBtn.addEventListener('click', addPPERow);
if (ppeTableBody) { addPPERow(); addPPERow(); }
if (ppeTableBody) ppeTableBody.addEventListener('click', (e)=>{ const btn=(e.target as HTMLElement).closest('button'); if(!btn) return; if((btn as HTMLElement).dataset.act==='remove'){ (btn as HTMLElement).closest('tr')!.remove(); }});

if (ppeForm) ppeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = (document.getElementById('ppe_site') as HTMLInputElement).value.trim();
  const date = (document.getElementById('ppe_date') as HTMLInputElement).value;
  const checker = (document.getElementById('ppe_checker') as HTMLInputElement).value.trim();
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }
  const rows = [...ppeTableBody!.querySelectorAll('tr')].map(tr => ({
    name: (tr.querySelector('.ppe-name') as HTMLInputElement).value.trim(),
    role_on_site: (tr.querySelector('.ppe-role') as HTMLSelectElement).value,
    items: {
      shoes: (tr.querySelector('.ppe-shoes') as HTMLInputElement).checked,
      vest: (tr.querySelector('.ppe-vest') as HTMLInputElement).checked,
      plugs: (tr.querySelector('.ppe-plugs') as HTMLInputElement).checked,
      goggles: (tr.querySelector('.ppe-goggles') as HTMLInputElement).checked,
      muffs: (tr.querySelector('.ppe-muffs') as HTMLInputElement).checked,
      gloves: (tr.querySelector('.ppe-gloves') as HTMLInputElement).checked,
    }
  })).filter(r => r.name);
  const nonCompliant = rows.some(r => !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves);
  const payload = { site, date, checked_by: checker, roster: rows, nonCompliant };
  try { const resp = await sendToFunction('D', payload); alert(resp.emailed ? 'Submitted. Non-compliance emailed.' : 'Submitted.'); ppeForm.reset(); if (ppeTableBody){ ppeTableBody.innerHTML=''; addPPERow(); addPPERow(); } }
  catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'D', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});

// ===== First Aid (B) UI logic =====
let faRowCount = 0;
function addItemRow(){
  if (!faTableBody) return;
  faRowCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type=\"text\" class=\"fa-name\" placeholder=\"e.g., Bandages\" required></td>
    <td><input type=\"number\" class=\"fa-qty\" min=\"0\" value=\"0\"></td>
    <td><input type=\"number\" class=\"fa-min\" min=\"0\" value=\"0\"></td>
    <td><input type=\"date\" class=\"fa-exp\"></td>
    <td><div class=\"controls\"><button type=\"button\" data-act=\"remove\">Remove</button></div></td>`;
  faTableBody.appendChild(tr);
}
if (faAddRowBtn) faAddRowBtn.addEventListener('click', addItemRow);
if (faTableBody) { addItemRow(); addItemRow(); }
if (faTableBody) faTableBody.addEventListener('click', (e)=>{ const btn=(e.target as HTMLElement).closest('button'); if(!btn) return; if((btn as HTMLElement).dataset.act==='remove'){ (btn as HTMLElement).closest('tr')!.remove(); }});

function within30Days(iso){ if(!iso) return false; const now=new Date(); const d=new Date(iso); const diff=(d.getTime()-now.getTime())/(1000*60*60*24); return diff<=30; }

if (faForm) faForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const site = (document.getElementById('fa_site') as HTMLInputElement).value.trim();
  const date = (document.getElementById('fa_date') as HTMLInputElement).value;
  const checker = (document.getElementById('fa_checker') as HTMLInputElement).value.trim();
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }
  const items = [...faTableBody!.querySelectorAll('tr')].map(tr=>{
    const name = (tr.querySelector('.fa-name') as HTMLInputElement).value.trim();
    const qty = parseInt((tr.querySelector('.fa-qty') as HTMLInputElement).value || '0',10);
    const min = parseInt((tr.querySelector('.fa-min') as HTMLInputElement).value || '0',10);
    const expiry = (tr.querySelector('.fa-exp') as HTMLInputElement).value || null;
    return { name, quantity: qty, min, expiry };
  }).filter(i=>i.name);
  const flagged = items.some(i => (i.quantity <= (i.min||0)) || (i.expiry && (within30Days(i.expiry) || new Date(i.expiry) < new Date())) );
  const payload = { site, date, checked_by: checker, items, flagged };
  try { const resp = await sendToFunction('B', payload); alert(resp.emailed ? 'Submitted. Restock/expiry emailed.' : 'Submitted.'); faForm.reset(); if (faTableBody){ faTableBody.innerHTML=''; addItemRow(); addItemRow(); } }
  catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'B', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});
