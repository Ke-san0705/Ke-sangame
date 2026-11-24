// node supabase/tests/compare-client-score.mjs | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
import { calculateScore } from '../../src/lib/score.ts'

const scenarios = [
  [0, 0, 0, 0],
  [0, 1, 1, 0],
  [8, 0, 1, 4],
  [9, 1, 0, 5],
  [10, 1, 1, 4],
  [19, 1, 1, 9],
  [24, 0, 0, 24],
  [25, 0, 0, 25],
  [30, 0, 0, 30],
  [600, 300, 300, 1],
]
const cases = [1, 2, 3, 4, 5].flatMap((level) =>
  scenarios.map(([correctCount, incorrectCount, passCount, maxCombo]) => {
    const { score, missCount } = calculateScore({ level, correctCount, incorrectCount, passCount, maxCombo })
    return `(${level}, ${correctCount}, ${missCount}, ${maxCombo}, ${score})`
  }),
)

console.log(`
begin;
set local role anon;
do $$
declare
  test_case record;
  actual_score integer;
begin
  for test_case in
    select * from (values ${cases.join(',\n      ')})
      as cases(level, correct_count, miss_count, max_combo, client_score)
  loop
    select score into strict actual_score
    from public.submit_ranking_score(
      'テスト', 'mix', test_case.level, 120,
      test_case.correct_count, test_case.miss_count, test_case.max_combo, gen_random_uuid()
    );
    if actual_score is distinct from test_case.client_score then
      raise exception 'Client/RPC score mismatch: %, RPC score %', test_case, actual_score;
    end if;
  end loop;
  raise notice 'Client/RPC score parity: % cases', ${cases.length};
end;
$$;
rollback;
`)
