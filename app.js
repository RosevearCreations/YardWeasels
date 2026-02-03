/* CONFIG: replace with your deployed function URL */
const FUNCTION_URL = 'https://YOUR-PROJECT.functions.supabase.co/your-function-name';
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


// Default today date for any date inputs present
(function setTodayDates(){
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth()+1).padStart(2,'0');
const dd = String(today.getDate()).padStart(2,'0');
if (tbDate) tbDate.value = `${yyyy}-${mm}-${dd}`;
if (ppeDate) ppeDate.value = `${yyyy}-${mm}-${dd}`;
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


// Wire all retry buttons
Array.from(document.querySelectorAll('[data-role="retry-outbox"]')).forEach(btn => btn.addEventListener('click', flushOutbox));


// ===== Toolbox Talk (E) UI logic =====
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
<td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
attendeesTable.appendChild(tr);
const canvas = tr.querySelector('canvas');
// @ts-ignore
const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
sigPads.set(id, pad);
}
if (addRowBtn) addRowBtn.addEventListener('click', () => addAttendeeRow());
if (attendeesTable) attendeesTable.addEventListener('click', (e) => {
const btn = e.target.closest('button'); if (!btn) return;
const tr = e.target.closest('tr'); const rowId = tr.dataset.rowId; const act = btn.dataset.act;
if (act === 'remove') { sigPads.delete(rowId); tr.remove(); }
else if (act === 'clear') { sigPads.get(rowId)?.clear(); }
});
if (attendeesTable) { addAttendeeRow(); addAttendeeRow(); }


if (tbForm) tbForm.addEventListener('submit', async (e) => {
e.preventDefault();
const site = document.getElementById('tb_site').value.trim();
const date = document.getElementById('tb_date').value;
const leader = document.getElementById('tb_leader').value.trim();
const notes = document.getElementById('tb_topics').value.trim();
if (!site || !date || !leader) { alert('Please fill Site, Date, and Discussion Leader.'); return; }
const attendees = [...attendeesTable.querySelectorAll('tr')].map(tr => {
const name = tr.querySelector('.att-name').value.trim();
const role = tr.querySelector('.att-role').value;
const pad = sigPads.get(tr.dataset.rowId); const signed = pad && !pad.isEmpty();
return { name, role_on_site: role, signature_png: signed ? pad.toDataURL('image/png') : null };
}).filter(a => a.name);
const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };
try { await sendToFunction('E', payload); alert('Toolbox submitted. Email sent.'); tbForm.reset(); attendeesTable.innerHTML=''; sigPads.clear(); addAttendeeRow(); addAttendeeRow(); }
catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'E', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});


// ===== PPE (D) UI logic =====
let ppeRowCount = 0;
function ppeRowTemplate(id){
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
<td><input type="checkbox" class="ppe-shoes" checked></td>
<td><input type="checkbox" class="ppe-vest" checked></td>
<td><input type="checkbox" class="ppe-plugs" checked></td>
<td><input type="checkbox" class="ppe-goggles" checked></td>
<td><input type="checkbox" class="ppe-muffs" checked></td>
<td><input type="checkbox" class="ppe-gloves" checked></td>
<td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
}
function addPPERow(){
if (!ppeTableBody) return;
ppeRowCount++; const id = `pr_${ppeRowCount}`; const tr = document.createElement('tr'); tr.dataset.rowId = id; tr.innerHTML = ppeRowTemplate(id); ppeTableBody.appendChild(tr);
}
if (ppeAddRowBtn) ppeAddRowBtn.addEventListener('click', addPPERow);
if (ppeTableBody) { addPPERow(); addPPERow(); }
if (ppeTableBody) ppeTableBody.addEventListener('click', (e)=>{ const btn=e.target.closest('button'); if(!btn) return; if(btn.dataset.act==='remove'){ btn.closest('tr').remove(); }});


if (ppeForm) ppeForm.addEventListener('submit', async (e) => {
e.preventDefault();
const site = document.getElementById('ppe_site').value.trim();
const date = document.getElementById('ppe_date').value;
const checker = document.getElementById('ppe_checker').value.trim();
if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }
const rows = [...ppeTableBody.querySelectorAll('tr')].map(tr => ({
name: tr.querySelector('.ppe-name').value.trim(),
role_on_site: tr.querySelector('.ppe-role').value,
items: {
shoes: tr.querySelector('.ppe-shoes').checked,
vest: tr.querySelector('.ppe-vest').checked,
plugs: tr.querySelector('.ppe-plugs').checked,
goggles: tr.querySelector('.ppe-goggles').checked,
muffs: tr.querySelector('.ppe-muffs').checked,
gloves: tr.querySelector('.ppe-gloves').checked,
}
})).filter(r => r.name);
const nonCompliant = rows.some(r => !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves);
const payload = { site, date, checked_by: checker, roster: rows, nonCompliant };
try { await sendToFunction('D', payload); alert(nonCompliant ? 'Submitted. Non-compliance emailed.' : 'Submitted.'); ppeForm.reset(); if (ppeTableBody){ ppeTableBody.innerHTML=''; addPPERow(); addPPERow(); } }
catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'D', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});
