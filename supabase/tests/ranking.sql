-- Run with psql -v ON_ERROR_STOP=1 after applying the migration to a test DB.
begin;
set local role anon;

do $$
declare
  device constant uuid := '0d844e6e-2812-40eb-9fa8-8161c650c36b';
begin
  begin
    perform public.submit_ranking_score('テスト', 'add', 1, 30, 151, 0, 151, device);
    raise exception 'Impossible correct count was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score('テスト', 'add', 1, 30, 100, 201, 5, device);
    raise exception 'Impossible input pace was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score('１２３４５６７８９０１', 'add', 1, 30, 9, 1, 5, device);
    raise exception 'Long nickname was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score(' ＦｕＣｋ ', 'add', 1, 30, 9, 1, 5, device);
    raise exception 'Blocked nickname was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score('テスト', 'add', 1, 30, 9, 1, 4, device);
    raise exception 'An impossibly short maximum combo was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score('テスト', 'add', 1, 30, 9, 1, 10, device);
    raise exception 'An impossibly long maximum combo was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_ranking_score('テスト', 'add', 1, 30, 9, 1, null, device);
    raise exception 'A missing maximum combo was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    insert into public.ranking_entries (nickname) values ('direct write');
    raise exception 'Direct table insert was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform device_id from public.ranking_cooldowns;
    raise exception 'Device IDs were readable';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  device constant uuid := '0d844e6e-2812-40eb-9fa8-8161c650c36b';
  entry record;
begin
  select * into strict entry
  from public.submit_ranking_score(' てすと ', 'add', 1, 30, 9, 1, 5, device);
  if entry.score <> 1069 or entry.nickname <> 'てすと' then
    raise exception 'Unexpected registration result: %', entry;
  end if;

  if not exists (
    select 1 from public.get_rankings('add', 1, 30)
    where id = entry.id and score = 1069 and nickname = 'てすと'
  ) then
    raise exception 'The registered score did not appear in rankings';
  end if;

  if exists (select 1 from public.get_rankings('add', 2, 30) where id = entry.id) then
    raise exception 'The registered score appeared in another category';
  end if;

  begin
    perform public.submit_ranking_score('別の名前', 'mix', 5, 60, 10, 0, 10, device);
    raise exception 'Device cooldown was bypassed across categories';
  exception when sqlstate 'PT429' then null;
  end;
end;
$$;

reset role;
update public.ranking_cooldowns
set submitted_at = clock_timestamp() - interval '30 seconds'
where device_id = '0d844e6e-2812-40eb-9fa8-8161c650c36b';
set local role anon;

do $$
declare
  score_after_cooldown integer;
begin
  select score into strict score_after_cooldown
  from public.submit_ranking_score(
    'てすと', 'add', 1, 30, 10, 0, 10, '0d844e6e-2812-40eb-9fa8-8161c650c36b'
  );
  if score_after_cooldown <> 1440 then
    raise exception 'Unexpected score after cooldown: %', score_after_cooldown;
  end if;
end;
$$;

do $$
declare
  test_case record;
  actual_score integer;
begin
  for test_case in
    -- Keep these cases in sync with src/lib/score.test.ts.
    select * from (values
      (1, 0, 0, 0, 0),
      (1, 0, 2, 0, -40),
      (1, 9, 1, 5, 1069),
      (1, 10, 2, 4, 960),
      (2, 15, 1, 9, 2340),
      (2, 19, 2, 9, 2949),
      (3, 8, 1, 5, 1476),
      (4, 24, 0, 24, 8870),
      (5, 25, 0, 25, 12600),
      (5, 30, 0, 30, 15120)
    ) as cases(level, correct_count, miss_count, max_combo, expected_score)
  loop
    select score into strict actual_score
    from public.submit_ranking_score(
      'テスト', 'add', test_case.level, 30,
      test_case.correct_count, test_case.miss_count, test_case.max_combo, gen_random_uuid()
    );
    if actual_score is distinct from test_case.expected_score then
      raise exception 'Expected score % for % correct and % misses, got %',
        test_case.expected_score, test_case.correct_count, test_case.miss_count, actual_score;
    end if;
  end loop;
end;
$$;

rollback;
