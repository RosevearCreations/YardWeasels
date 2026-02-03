// Deno/Edge Function – insert submission, then email via Resend
// Environment variables set on the function:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)
// - RESEND_API_KEY
// - HSE_EMAIL
// - CHRIS_EMAIL (optional)


import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const cors = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'POST, OPTIONS',
'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};


serve(async (req) => {
if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });


let body: any;
try { body = await req.json(); }
catch { return new Response(JSON.stringify({ ok:false, error:'invalid_json' }), { status: 400, headers: { ...cors, 'Content-Type':'application/json' } }); }


const { formType, payload } = body as { formType?: string; payload?: any };
const missing: string[] = [];
if (!formType) missing.push('formType');
if (!payload) missing.push('payload');
else {
if (!payload.site) missing.push('payload.site');
if (!payload.date) missing.push('payload.date');
}
if (missing.length) return new Response(JSON.stringify({ ok:false, error:'Missing fields', missing }), { status: 400, headers: { ...cors, 'Content-Type':'application/json' } });


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(supabaseUrl, serviceKey);


const { data: sub, error: subErr } = await sb
.from('submissions')
.insert({ site: payload.site, form_type: formType, date: payload.date, submitted_by: payload.submitted_by ?? payload.checked_by ?? null, payload })
.select('id')
.single();
if (subErr) return new Response(JSON.stringify({ ok:false, error: subErr.message }), { status: 500, headers: { ...cors, 'Content-Type':'application/json' } });


if (formType === 'E' && Array.isArray(payload.attendees) && payload.attendees.length) {
const rows = payload.attendees.filter((a: any) => a && a.name).map((a: any) => ({
submission_id: sub.id,
name: a.name,
role_on_site: a.role_on_site || null,
signature_png_base64: a.signature_png || null,
}));
if (rows.length) {
const { error } = await sb.from('toolbox_attendees').insert(rows);
if (error) return new Response(JSON.stringify({ ok:false, error: error.message }), { status: 500, headers: { ...cors, 'Content-Type':'application/json' } });
}
}
// Email routing
const to: string[] = [];
const HSE = Deno.env.get('HSE_EMAIL') || '';
const CHRIS = Deno.env.get('CHRIS_EMAIL') || '';
if (formType === 'E') { if (HSE) to.push(HSE); }
if (formType === 'D' && payload.nonCompliant) { if (HSE) to.push(HSE); if (CHRIS) to.push(CHRIS); }


const apiKey = Deno.env.get('RESEND_API_KEY');
if (apiKey && to.length) {
let subject = `${formType} – ${payload.site} – ${payload.date}`;
let html = `<h2>Form ${formType} – ${payload.site} – ${payload.date}</h2>`;
if (formType === 'E') {
html += `<p><b>Leader:</b> ${payload.submitted_by || ''}</p>`;
html += `<p><b>Notes:</b><br>${(payload.topic_notes || '').replace(/</g,'&lt;')}</p>`;
html += `<p><b>Attendees:</b> ${Array.isArray(payload.attendees) ? payload.attendees.length : 0}</p>`;
subject = `Toolbox Talk – ${payload.site} – ${payload.date}`;
}
if (formType === 'D') {
html += `<p><b>Checked by:</b> ${payload.checked_by || ''}</p>`;
html += `<p><b>Non-compliance:</b> ${payload.nonCompliant ? 'YES' : 'No'}</p>`;
}


await fetch('https://api.resend.com/emails', {
method: 'POST',
headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
body: JSON.stringify({ from: 'YWI HSE <onboarding@resend.dev>', to, subject, html })
});
}


return new Response(JSON.stringify({ ok:true, id: sub.id }), { status: 200, headers: { ...cors, 'Content-Type':'application/json' } });
});
