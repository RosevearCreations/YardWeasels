/* CONFIG: replace with your deployed function URL later */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';

const OUTBOX_KEY = 'ywi_outbox_v1';

const attendeesTable = document.getElementById('attendeesTable').querySelector('tbody');
const addRowBtn = document.getElementById('addRowBtn');
const retryBtn = document.getElementById('retryBtn');
const form = document.getElementById('toolboxForm');
const dateInput = document.getElementById('tb_date');

// default date = today
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth()+1).padStart(2,'0');
const dd = String(today.getDate()).padStart(2,'0');
dateInput.value = `${yyyy}-${mm}-${dd}`;

let rowCount = 0;
const sigPads = new Map(); // rowId -> SignaturePad

function addAttendeeRow(initialName = '', initialRole = '') {
  rowCount++;
  const id = `row_${rowCount}`;
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
        <div class="controls">
          <button type="button" data-act="clear">Clear</button>
        </div>
      </div>
    </td>
    <td>
      <div class="controls">
        <button type="button" data-act="remove">Remove</button>
      </div>
    </td>
  `;
  attendeesTable.appendChild(tr);
  const canvas = tr.querySelector('canvas');
  const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
  sigPads.set(id, pad);
}

addRowBtn.addEventListener('click', () => addAttendeeRow());
attendeesTable.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const tr = e.target.closest('tr');
  const rowId = tr.dataset.rowId;
  const act = btn.dataset.act;
  if (act === 'remove') {
    sigPads.delete(rowId);
    tr.remove();
  } else if (act === 'clear') {
    sigPads.get(rowId)?.clear();
  }
});

// start with two rows for convenience
addAttendeeRow();
addAttendeeRow();

function getOutbox(){
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
}
function setOutbox(list){ localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }

async function sendPayload(payload){
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formType: 'E', payload })
  });
  if (!res.ok) throw new Error('Function error');
  return res.json();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = document.getElementById('tb_site').value.trim();
  const date = document.getElementById('tb_date').value;
  const leader = document.getElementById('tb_leader').value.trim();
  const notes = document.getElementById('tb_topics').value.trim();

  if (!site || !date || !leader) {
    alert('Please fill Site, Date, and Discussion Leader.');
    return;
  }

  const attendees = [...attendeesTable.querySelectorAll('tr')].map(tr => {
    const name = tr.querySelector('.att-name').value.trim();
    const role = tr.querySelector('.att-role').value;
    const pad = sigPads.get(tr.dataset.rowId);
    const signed = pad && !pad.isEmpty();
    return { name, role_on_site: role, signature_png: signed ? pad.toDataURL('image/png') : null };
  }).filter(a => a.name);

  const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };

  try {
    await sendPayload(payload);
    alert('Submitted. Email sent to HSE.');
    form.reset();
    attendeesTable.innerHTML = ''; sigPads.clear(); addAttendeeRow(); addAttendeeRow();
  } catch(err){
    const outbox = getOutbox();
    outbox.push({ ts: Date.now(), formType: 'E', payload });
    setOutbox(outbox);
    alert('Offline or server error. Saved to Outbox; will retry when online.');
  }
});

async function flushOutbox(){
  const outbox = getOutbox();
  if (!outbox.length) { alert('Outbox is empty.'); return; }
  const remaining = [];
  for (const item of outbox){
    try { await sendPayload(item.payload); }
    catch(e){ remaining.push(item); }
  }
  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}

retryBtn.addEventListener('click', flushOutbox);

window.addEventListener('online', () => { if (getOutbox().length) flushOutbox(); });

