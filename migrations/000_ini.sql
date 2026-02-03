-- Core submissions table: store each form as a generic payload
create table if not exists submissions (
  id bigserial primary key,
  site text not null,
  form_type text not null, -- 'E' toolbox, later 'A','B','C','D'
  date date not null,
  submitted_by text,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Attendees for Toolbox Talk (optional normalized table)
create table if not exists toolbox_attendees (
  id bigserial primary key,
  submission_id bigint references submissions(id) on delete cascade,
  name text not null,
  role_on_site text,
  signature_png_base64 text -- store data URL string
);

-- RLS (optional to enable later if needed)
-- alter table submissions enable row level security;
-- create policy anon_insert on submissions for insert to public using (true) with check (true);
-- We will generally insert from the Edge Function (service role), so RLS can remain disabled initially.
