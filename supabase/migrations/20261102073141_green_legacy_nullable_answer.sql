-- Preserva respostas ainda não iniciadas, sem reescrever registros.
alter table public.dd_requirement_state alter column answer drop not null;
