-- WEBCRAFT administrator access
-- 1) Create the administrator account first in Supabase Dashboard:
--    Authentication -> Users -> Add user.
-- 2) Replace admin@example.com below with that exact email, then run this SQL.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

-- Add the administrator account:
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
