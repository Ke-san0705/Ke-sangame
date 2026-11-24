# ラウンド7 統合・回帰確認

対象は [Issue #135](https://github.com/Ke-san0705/Ke-sangame/issues/135)。検証元は R7-01〜R7-08 が入った `main` の `1820c10`。

## 受入項目

| 項目 | 検証 |
| --- | --- |
| 自動確定・設定保存 | Chromium の実入力で計算・討伐・刹那の3モードを確認。再読み込みで設定が復元されること、刹那で ON は数字キー、OFF は Enter を合図前に押すとお手つきになることを検証。Vitest で複数桁・クリア・パス・負数の手動確定も確認 |
| 討伐の割り込み演出 | Chromium で自動確定による12連続正解と次の出題を確認。性能計測では32連続正解で全数字入力の反映を検証。Vitest で10コンボ時の通常攻撃とHP回復廃止、HUDの固定を確認 |
| 敵密度・吹っ飛び | Chromium の画面で敵の最大同時数・撃破飛翔・ゴーレムのひるみと撃破飛翔を計測。Vitest で時間・コンボ・サバイバルの倍率境界と上限を確認 |
| FINISH・無双・KO | Chromium で FINISH → 構え → 斬撃 → 衝撃波 → 静寂 → 結果の順、KOの昇順・結果一致・再読み込み後の累計KOを検証。Vitest でスキップ時も結果と保存回数が一致することを確認 |
| 刹那のサイズ・敗北演出 | デスクトップとモバイルの Chromium で0.7倍の設定、両者の表示範囲、膝を落とした後の倒れ込み、勝敗判定を検証。Vitest で誤答とCPU先着でも相手が勝つことを確認 |

## Chromium 実プレイ

- 討伐で12問を自動確定し、FINISH → 構え → 斬撃 → 衝撃波 → 静寂 → リザルトの順に遷移。KO は演出の 1 → 6 → 11 → 16 → 21、リザルトと再読み込み後の累計はいずれも21。
- 刹那は PC（1280×800）とモバイル（390×844）で、構え時の両者のサイズと表示範囲を確認。実入力のお手つき2回で、膝を曲げた後に倒れ込み、決着表示まで両環境で817 ms。再戦で手動／自動確定による勝利まで確認。

| 討伐 | 刹那 |
| --- | --- |
| [FINISH](hunt-finish.jpg) | [PCの構え](setsuna-desktop-stance.jpg) |
| [無双の連撃](hunt-release.jpg) | [PCの敗北](setsuna-desktop-defeat.jpg) |
| [リザルトのKO](hunt-result.jpg) | [モバイルの構え](setsuna-mobile-stance.jpg)・[敗北](setsuna-mobile-defeat.jpg) |

## 回帰

- `npm test` で16ファイル273件。計算の出題・回答・採点、ランキング画面、オフライン時の自己ベスト、旧形式の自己ベスト、討伐の記録、刹那の段位と再戦記録を含む。
- `npm run lint` と `npm run build` が成功。
- ラウンド6終了時点の `2c97cd2` との比較で `src/lib/score.ts` と `supabase/migrations/` に差分なし。
- PGlite 0.6.0（PostgreSQL 19 WASM）の一時DBにマイグレーションを適用し、`supabase/tests/ranking.sql` を実行。匿名ロールで投稿・取得・カテゴリ分離・クールダウン・入力上限を検証。
- `compare-client-score.mjs` が生成する SQL を同じDBで実行し、全レベルで50ケースのクライアント/RPC一致を確認。ゼロ件・負スコア・90%の境界・コンボ係数の上限・最大入力数を含む。

## 調整値

| 項目 | 設定 |
| --- | --- |
| 自動確定の初期値 | `src/lib/autoConfirm.ts` の `DEFAULT_AUTO_CONFIRM`。保存と桁数照合も同じモジュールに集約 |
| 出現倍率と敵の上限、コンボ別攻撃対象数 | `src/lib/enemyApproachConfig.ts` の `ENEMY_DENSITY`、`ENEMY_DIFFICULTY`、`COMBO_SPAWN_MULTIPLIERS`、`ATTACK_STAGES` |
| 吹っ飛び・ゴーレムのひるみ | `src/lib/attackEffects.ts` の `ATTACK_EFFECTS.knockback` |
| FINISHの表示時間 | `src/lib/huntConfig.ts` の `HUNT_TIMING.finishDisplayMs`（800 ms） |
| 無双の時間・KOの段階 | `src/lib/releaseConfig.ts` の `RELEASE`（全体3,600 ms、初撃450 ms、静寂開始3,000 ms）。段階別の閾値・連撃数・増援数も同じ設定に集約 |
| 刹那のサイズ・間合い・決着時間・倒れ込み | `src/lib/setsunaConfig.ts` と `src/lib/setsunaDefeat.json` |

## 再現手順

ローカルで本番ビルドを起動して、Chromium のキーボード・タッチ入力で確認する。

```sh
npm ci
npm run build
npm ci --prefix benchmarks/rendering
npm run preview -- --host 127.0.0.1 --port 4184 --strictPort
# 別の端末で実行
node benchmarks/rendering/check-issue135.mjs /tmp/ke-sangame-issue135
```

スコア照合スクリプトには Node.js 24 を使う。DBは空の検証用 PostgreSQL に `anon`、`authenticated` ロールを作り、マイグレーションを順に適用してから実行する。

```sh
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f supabase/tests/ranking.sql
node supabase/tests/compare-client-score.mjs | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
```

## 確認待ち

- リポジトリ内の仕様書・履歴および Issue #135 からは、「ラウンド7仕様案（確定版、2026-11-24）」§10 の正本への参照先を確認できなかった。Issue #135 と R7-01〜R7-08 に記載された受入条件で検証した。
