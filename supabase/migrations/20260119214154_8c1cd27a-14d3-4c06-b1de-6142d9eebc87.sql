-- FIX: monthly recurring task generation (retry)

create extension if not exists pg_cron;

create table if not exists public.task_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  user_id uuid not null,
  assigned_to uuid null,
  title text not null,
  description text null,
  type public.task_type null,
  platform public.social_media_platform null,
  file_url text null,
  deadline_day smallint not null,
  is_active boolean not null default true
);

-- trigger (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'task_recurring_rules_set_updated_at'
  ) then
    create trigger task_recurring_rules_set_updated_at
    before update on public.task_recurring_rules
    for each row
    execute function public.update_updated_at_column();
  end if;
end $$;

alter table public.task_recurring_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_recurring_rules' and policyname='Admins can read recurring rules'
  ) then
    create policy "Admins can read recurring rules"
    on public.task_recurring_rules
    for select
    using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'super_admin'::public.app_role));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_recurring_rules' and policyname='Admins can create recurring rules'
  ) then
    create policy "Admins can create recurring rules"
    on public.task_recurring_rules
    for insert
    with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'super_admin'::public.app_role));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_recurring_rules' and policyname='Admins can update recurring rules'
  ) then
    create policy "Admins can update recurring rules"
    on public.task_recurring_rules
    for update
    using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'super_admin'::public.app_role));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_recurring_rules' and policyname='Admins can delete recurring rules'
  ) then
    create policy "Admins can delete recurring rules"
    on public.task_recurring_rules
    for delete
    using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'super_admin'::public.app_role));
  end if;
end $$;

alter table public.tasks add column if not exists recurring_rule_id uuid null;

create unique index if not exists tasks_recurring_unique
on public.tasks (recurring_rule_id, deadline)
where recurring_rule_id is not null;

create or replace function public.generate_recurring_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with active_rules as (
    select
      r.*,
      make_date(
        extract(year from current_date)::int,
        extract(month from current_date)::int,
        least(
          r.deadline_day,
          extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::int
        )
      ) as deadline_this_month,
      make_date(
        extract(year from (current_date + interval '1 month'))::int,
        extract(month from (current_date + interval '1 month'))::int,
        least(
          r.deadline_day,
          extract(day from (date_trunc('month', current_date + interval '1 month') + interval '1 month - 1 day'))::int
        )
      ) as deadline_next_month
    from public.task_recurring_rules r
    where r.is_active = true
  ), due_rules as (
    select
      ar.*,
      case
        when current_date = (ar.deadline_this_month - interval '7 days')::date then ar.deadline_this_month
        when current_date = (ar.deadline_next_month - interval '7 days')::date then ar.deadline_next_month
        else null::date
      end as new_deadline
    from active_rules ar
  ), to_insert as (
    select * from due_rules where new_deadline is not null
  ), max_num as (
    select coalesce(max(task_number), 99) as max_task_number from public.tasks
  ), numbered as (
    select
      ti.*,
      (select max_task_number from max_num) + row_number() over (order by ti.created_at, ti.id) as next_task_number
    from to_insert ti
  ), inserted as (
    insert into public.tasks (
      user_id,
      task_number,
      title,
      description,
      type,
      platform,
      assigned_to,
      deadline,
      file_url,
      notes,
      status,
      recurring_rule_id
    )
    select
      n.user_id,
      n.next_task_number,
      n.title,
      n.description,
      n.type,
      case when n.type = 'social_media' then n.platform else null end,
      n.assigned_to,
      timezone('utc', n.new_deadline::timestamp),
      n.file_url,
      null,
      'pending'::public.task_status,
      n.id
    from numbered n
    on conflict (recurring_rule_id, deadline) where recurring_rule_id is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

-- daily schedule
DO $sched$
begin
  if not exists (select 1 from cron.job where jobname = 'generate-recurring-tasks-daily') then
    perform cron.schedule(
      'generate-recurring-tasks-daily',
      '0 0 * * *',
      'select public.generate_recurring_tasks();'
    );
  end if;
end $sched$;