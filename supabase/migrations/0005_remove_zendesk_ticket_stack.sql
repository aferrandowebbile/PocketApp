-- Remove Zendesk/ticket stack after product scope change.

-- Notifications no longer reference ticket ids.
alter table if exists public.notifications
drop constraint if exists notifications_ticket_id_fkey;

alter table if exists public.notifications
drop column if exists ticket_id;

-- Remove ticket-audio storage policies and bucket.
drop policy if exists "ticket audio read company" on storage.objects;
drop policy if exists "ticket audio upload non viewer" on storage.objects;

-- Remove ticket tables and related function/type definitions.
drop table if exists public.ticket_messages cascade;
drop table if exists public.tickets cascade;

drop index if exists public.ticket_messages_ticket_created_idx;

drop function if exists public.can_reply_tickets();

drop type if exists public.ticket_message_type;
drop type if exists public.ticket_direction;
