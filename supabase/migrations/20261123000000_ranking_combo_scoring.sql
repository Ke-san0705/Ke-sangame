begin;

-- Replace the old submission signature. Stored ranking entries keep their original scores.
drop function public.submit_ranking_score(text, text, integer, integer, integer, integer, uuid);

create function public.submit_ranking_score(p_nickname text,
  p_operation text,
  p_level integer,
  p_duration_seconds integer,
  p_correct_count integer,
  p_miss_count integer,
  p_max_combo integer,
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
  base_points integer;
  accuracy_tenths integer;
  combo_tenths integer;
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

  -- Misses split the correct answers into at most miss_count + 1 streaks.
  if p_max_combo is null or p_max_combo not between 0 and p_correct_count
     or p_max_combo::bigint * (p_miss_count + 1) < p_correct_count then
    raise exception using errcode = '22023', message = 'Invalid maximum combo';
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

  base_points := case p_level
    when 1 then 100
    when 2 then 130
    when 3 then 170
    when 4 then 220
    when 5 then 280
  end;
  accuracy_tenths := case
    when attempts = 0 then 10
    when p_miss_count = 0 then 12
    when p_correct_count * 10 >= attempts * 9 then 11
    else 10
  end;
  combo_tenths := 10 + least(5, p_max_combo / 5);

  -- Match the client: round the correct-answer subtotal to the nearest point.
  calculated_score := (p_correct_count * base_points * accuracy_tenths * combo_tenths + 50) / 100
    - p_miss_count * 20;

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

revoke all on function public.submit_ranking_score(text, text, integer, integer, integer, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_ranking_score(text, text, integer, integer, integer, integer, integer, uuid)
  to anon, authenticated;

commit;
