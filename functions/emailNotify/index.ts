// Deno/Edge Function – insert submission, then email via Resend
// Deploy via Supabase Dashboard or CLI: supabase functions deploy emailNotify
// Environment variables required in Function settings:
//  - RESEND_API_KEY
//  - HSE_EMAIL
//  - CHRIS_EMAIL (optional for other forms later)
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_ROLE

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { formType, payload } = body as { formType: string; payload: any };

    // Basic validation
    if (!formType || !payload || !payload.site || !payload.date) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Insert into submissions
    const { data: sub, error: subErr } = await sb
      .from('submissions')
      .insert({ site: payload.site, form_type: formType, date: payload.date, submitted_by: payload.submitted_by || null, payload })
      .select('id')
      .single();

    if (subErr) throw subErr;

    // If Toolbox Talk (E), insert attendees
    if (formType === 'E' && Array.isArray(payload.attendees)) {
      const rows = payload.attendees.filter((a: any) => a && a.name).map((a: any) => ({
        submission_id: sub.id,
        name: a.name,
        role_on_site: a.role_on_site || null,
        signature_png_base64: a.signature_png || null,
      }));
      if (rows.length) {
        const { error } = await sb.from('toolbox_attendees').insert(rows);
        if (error) throw error;
      }
    }

    // Email routing rules
    const to: string[] = [];
    const HSE = Deno.env.get('veardan@hotmail.com');
    const CHRIS = Deno.env.get('jfrosevear@outlook.com');
    if (formType === 'E') { if (HSE) to.push(HSE); }
    // Later:
    // if (formType === 'A' || formType === 'C') { to.push(HSE!, CHRIS!); }
    // if (formType === 'B' && payload.flagged) { to.push(HSE!, CHRIS!); }
    // if (formType === 'D' && payload.nonCompliant) { to.push(HSE!, CHRIS!); }

    // Build a simple HTML summary
    const html = `
      <h2>Toolbox Talk – ${payload.site} – ${payload.date}</h2>
      <p><b>Leader:</b> ${payload.submitted_by || ''}</p>
      <p><b>Notes:</b><br>${(payload.topic_notes || '').replace(/</g,'&lt;')}</p>
      <p><b>Attendees:</b> ${Array.isArray(payload.attendees) ? payload.attendees.length : 0}</p>
    `;

    // Send via Resend REST API (works in Deno)
    const apiKey = Deno.env.get('re_g1Lt4ZsF_HGZU61JKRtRxAjaXM5jkWHR3');
    if (apiKey && to.length) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'YWI HSE <onboarding@resend.dev>',
          to,
          subject: `Toolbox Talk – ${payload.site} – ${payload.date}`,
          html
        })
      });
    }

    return new Response(JSON.stringify({ ok: true, id: sub.id }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
