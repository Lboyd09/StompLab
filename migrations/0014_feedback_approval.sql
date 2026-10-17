-- Feedback reaches the research prompt only after an admin approves it.

alter table feedback add column if not exists approved_at timestamptz;
alter table feedback add column if not exists rejected_at timestamptz;

create index if not exists feedback_approved_idx on feedback (approved_at desc) where approved_at is not null;
