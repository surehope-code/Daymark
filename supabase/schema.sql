-- 在 Supabase SQL Editor 中执行。快照包含任务、思想库与生活记录。
create table if not exists public.daymark_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.daymark_snapshots enable row level security;
drop policy if exists "read own snapshot" on public.daymark_snapshots;
create policy "read own snapshot" on public.daymark_snapshots for select to authenticated using (auth.uid() = user_id);
-- 写操作只允许经过下面的版本检查函数，不能绕过冲突检测直接更新。
revoke all on public.daymark_snapshots from anon, authenticated;
grant select on public.daymark_snapshots to authenticated;
create or replace function public.save_daymark(expected_revision bigint, new_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); next_revision bigint;
begin
  if uid is null then raise exception '需要登录'; end if;
  if new_payload->>'version' is distinct from '1'
     or jsonb_typeof(new_payload->'tasks') is distinct from 'array'
     or jsonb_typeof(new_payload->'thoughts') is distinct from 'array'
     or jsonb_typeof(new_payload->'journals') is distinct from 'object'
     or octet_length(new_payload::text) > 15000000 then
    raise exception '数据格式或大小无效';
  end if;
  if expected_revision = 0 then
    insert into public.daymark_snapshots(user_id,payload,revision) values(uid,new_payload,1)
    on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.daymark_snapshots set payload=new_payload, revision=revision+1, updated_at=now()
    where user_id=uid and revision=expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception '云端已有更新，请先备份本地数据，再下载云端最新版本'; end if;
  return next_revision;
end $$;
revoke all on function public.save_daymark(bigint,jsonb) from public, anon;
grant execute on function public.save_daymark(bigint,jsonb) to authenticated;
