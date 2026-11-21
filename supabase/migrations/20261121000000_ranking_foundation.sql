begin;

create table public.ranking_entries (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 10),
  operation text not null check (operation in ('add', 'subtract', 'multiply', 'divide', 'mix')),
  level integer not null check (level between 1 and 5),
  duration_seconds integer not null check (duration_seconds in (30, 60, 120)),
  correct_count integer not null check (correct_count >= 0),
  miss_count integer not null check (miss_count >= 0),
  score integer not null,
  submitted_at timestamptz not null
);

create index ranking_entries_category_order_idx on public.ranking_entries
  (operation, level, duration_seconds, score desc, submitted_at asc, id asc);

create table public.ranking_cooldowns (
  device_id uuid primary key,
  submitted_at timestamptz not null
);

create table public.ranking_blocked_words (
  word text primary key check (word <> '')
);

insert into public.ranking_blocked_words (word) values
  ('死ね'), ('しね'), ('殺す'), ('ころす'), ('バカ'), ('ばか'), ('fuck'), ('shit');

alter table public.ranking_entries enable row level security;
alter table public.ranking_cooldowns enable row level security;
alter table public.ranking_blocked_words enable row level security;

revoke all on public.ranking_entries, public.ranking_cooldowns, public.ranking_blocked_words
  from public, anon, authenticated;

create function public.submit_ranking_score(
  p_nickname text,
  p_operation text,
  p_level integer,
  p_duration_seconds integer,
  p_correct_count integer,
  p_miss_count integer,
  p_device_id uuid
)
returns table (id bigint, nickname text, score integer, submitted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_nickname text := regexp_replace(p_nickname, '^[[:space:]　]+|[[:space:]　]+$', '', 'g');
  attempts bigint := p_correct_count::bigint + p_miss_count;
  calculated_score integer;
  accepted_at timestamptz;
begin
  if p_operation is null or p_operation not in ('add', 'subtract', 'multiply', 'divide', 'mix')
     or p_level is null or p_level not between 1 and 5
     or p_duration_seconds is null or p_duration_seconds not in (30, 60, 120)
     or p_device_id is null then
    raise exception using errcode = '22023', message = 'Invalid ranking category or device ID';
  end if;

  -- Cap correct answers at five per second and total inputs at ten per second.
  if p_correct_count is null or p_correct_count < 0 or p_correct_count > p_duration_seconds * 5
     or p_miss_count is null or p_miss_count < 0 or attempts > p_duration_seconds * 10 then
    raise exception using errcode = '22023', message = 'Invalid answer counts or pace';
  end if;

  if clean_nickname is null or char_length(clean_nickname) not between 1 and 10
     or clean_nickname ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'Invalid nickname';
  end if;

  if exists (
    select 1 from public.ranking_blocked_words as blocked
    where strpos(lower(normalize(clean_nickname, NFKC)), lower(normalize(blocked.word, NFKC))) > 0
  ) then
    raise exception using errcode = '22023', message = 'Nickname contains a blocked word';
  end if;

  -- Match the client score tiers using integer arithmetic.
  calculated_score := case
    when attempts = 0 then 0
    when p_miss_count = 0 then p_correct_count * 120
    when p_correct_count * 10 >= attempts * 9 then p_correct_count * 110
    else p_correct_count * 100
  end - p_miss_count * 20;

  -- The unique device row serializes submissions, including across categories.
  insert into public.ranking_cooldowns as cooldown (device_id, submitted_at)
  values (p_device_id, clock_timestamp())
  on conflict (device_id) do update
    set submitted_at = clock_timestamp()
    where cooldown.submitted_at <= clock_timestamp() - interval '30 seconds'
  returning cooldown.submitted_at into accepted_at;

  if not found then
    raise exception using errcode = 'PT429', message = 'Wait 30 seconds between submissions';
  end if;

  return query
    insert into public.ranking_entries as entry (
      nickname, operation, level, duration_seconds, correct_count, miss_count, score, submitted_at
    )
    values (
      clean_nickname, p_operation, p_level, p_duration_seconds,
      p_correct_count, p_miss_count, calculated_score, accepted_at
    )
    returning entry.id, entry.nickname, entry.score, entry.submitted_at;
end;
$$;

create function public.get_rankings(
  p_operation text,
  p_level integer,
  p_duration_seconds integer,
  p_limit integer default 50
)
returns table (id bigint, nickname text, score integer, submitted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select entry.id, entry.nickname, entry.score, entry.submitted_at
  from public.ranking_entries as entry
  where entry.operation = p_operation
    and entry.level = p_level
    and entry.duration_seconds = p_duration_seconds
  order by entry.score desc, entry.submitted_at asc, entry.id asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.submit_ranking_score(text, text, integer, integer, integer, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.get_rankings(text, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.submit_ranking_score(text, text, integer, integer, integer, integer, uuid)
  to anon, authenticated;
grant execute on function public.get_rankings(text, integer, integer, integer)
  to anon, authenticated;

commit;
