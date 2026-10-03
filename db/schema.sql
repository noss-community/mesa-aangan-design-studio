-- Aangan Studio voice agent — schema
-- Run with `npm run db:migrate` (reads DATABASE_URL from .env.local / environment).

create extension if not exists pgcrypto;

create table if not exists calls (
  id                     uuid primary key default gen_random_uuid(),
  vaani_call_id          text unique not null,
  caller_phone           text,
  caller_name            text,
  -- From Vaani's own data-extraction config (lib/vaaniAgent.ts) — captured on call_postprocessing.
  project_location       text,
  project_type           text,

  call_started_at        timestamptz not null default now(),
  call_ended_at          timestamptz,
  first_response_at      timestamptz,
  within_working_hours   boolean not null default true,

  status                 text not null default 'in_progress'
                           check (status in (
                             'in_progress', 'qualified', 'booked',
                             'declined', 'escalated', 'abandoned'
                           )),

  -- { criterion_1: { status: 'pass'|'fail'|'unclear'|'not_assessed', note: text }, ... criterion_5 }
  qualification          jsonb not null default '{}'::jsonb,

  escalation_triggered   boolean not null default false,
  escalation_condition   smallint,
  escalation_reason      text,

  booking_status         text not null default 'not_ready'
                           check (booking_status in ('not_ready', 'offered', 'confirmed', 'declined')),
  offered_slot           jsonb,
  booked_slot_start      timestamptz,
  booked_slot_end        timestamptz,
  calcom_booking_id      text,
  hubspot_deal_id        text,

  gemini_tokens_used     integer not null default 0,
  gemini_calls_count     integer not null default 0,
  vaani_duration_seconds numeric not null default 0,

  summary                text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Idempotent column additions for databases created before project_location/project_type existed
-- (the CREATE TABLE above only applies to a brand-new database).
alter table calls add column if not exists project_location text;
alter table calls add column if not exists project_type text;

create index if not exists idx_calls_call_started_at on calls (call_started_at);
create index if not exists idx_calls_status on calls (status);

create table if not exists call_turns (
  id                       bigserial primary key,
  call_id                  uuid not null references calls (id) on delete cascade,
  turn_index               integer not null,
  role                     text not null check (role in ('caller', 'agent')),
  text                     text not null,
  -- Vaani's own "HH:MM:SS" label from its transcript string — the actual in-call time, distinct
  -- from created_at below (which is just when we happened to insert the row, in a tight loop).
  at_label                 text,
  gemini_prompt_tokens     integer,
  gemini_completion_tokens integer,
  gemini_total_tokens      integer,
  created_at               timestamptz not null default now()
);

alter table call_turns add column if not exists at_label text;

create index if not exists idx_call_turns_call_id on call_turns (call_id);

create table if not exists handoff_notes (
  id                 uuid primary key default gen_random_uuid(),
  call_id            uuid not null unique references calls (id) on delete cascade,
  transcript         jsonb not null,
  summary            text,
  criteria_answers   jsonb,
  reason             text,
  booked_slot        jsonb,
  -- Delivery channel is intentionally unresolved (Telegram vs email — next session's decision).
  channel            text not null default 'pending',
  delivered          boolean not null default false,
  created_at         timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calls_updated_at on calls;
create trigger trg_calls_updated_at
  before update on calls
  for each row execute function set_updated_at();
