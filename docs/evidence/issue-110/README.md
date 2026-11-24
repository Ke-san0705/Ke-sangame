# #110 ラウンド6 Phase 4 検証記録

検証基準は [Issue #110](https://github.com/Ke-san0705/Ke-sangame/issues/110) の記載事項。作業環境にはラウンド6の仕様書がなく、§6.6 / §9.1 の原文との全項目照合は未実施。

| 分類 | 確認内容 | 再現・証拠 |
| --- | --- | --- |
| 討伐 | 敵の出現率・接触・HP・攻撃段階、10コンボ必殺技、パス、締切と敗北の優先順位 | [敵](../../../src/lib/enemyApproach.test.ts) · [戦闘](../../../src/lib/combat.test.ts) · [画面](../../../src/components/GameScreen.test.tsx) |
| 討伐 | チャージ計算、解放の全段階・規模の境界・スキップと完走の結果一致、累計KO保存 | [チャージ](../../../src/lib/charge.test.ts) · [解放](../../../src/lib/release.test.ts) · [画面](../../../src/components/GameScreen.test.tsx) · [保存](../../../src/App.test.tsx) |
| 刹那 | 合図と締切の境界、連続対戦、お手つき、難易度とCPU下限、決着音と停止、強敵・段位・個別再戦 | [判定](../../../src/lib/setsuna.test.ts) · [対戦画面](../../../src/components/SetsunaScreen.test.tsx) · [アプリ](../../../src/App.test.tsx) |
| 共通 | キーボード・テンキー、HUDと入力欄の固定、演出抑制時の判定とチャージ・解放、効果音の上限と解放 | [画面](../../../src/components/GameScreen.test.tsx) · [演出](../../../src/components/GameScreen.effects.test.tsx) · [音声](../../../src/lib/soundEffects.test.ts) |
| 回帰 | 計算モードの入力・正確率・スコア、自己ベストの既存形式、ランキング種目切替、未設定時と再接続時の操作、刹那の旧記録 | [アプリ](../../../src/App.test.tsx) · [ランキング](../../../src/App.ranking.test.tsx) · [スコア](../../../src/lib/score.test.ts) · [刹那](../../../src/lib/setsuna.test.ts) |
| DB回帰 | 両マイグレーションを適用し、匿名ロールの書き込み制限・入力検証・クールダウン・再計算を含む既存SQLを実行 | [SQLテスト](../../../supabase/tests/ranking.sql) · [実行ログ](ranking-sql.txt) |

DBテストは一時的な PGlite 0.6.0 インスタンスで実行し、`anon` と `authenticated` ロールを作成してからマイグレーションを順に適用した。

## 上限と再利用

| 対象 | 上限と動作 |
| --- | --- |
| 討伐の敵スプライト | Lv.1〜5で同時6〜10体。最大10個の画像要素を保持し、画面上の敵に割り当てる。敵のID・耐久・当たり判定は戦闘状態で管理する。 |
| 解放の粒子 | 16 / 24 / 36 / 48個（段階別）。収束と爆発で同じ要素を使用し、それ以外の段階では非表示。抑制時は0個。 |
| 重複VFX | 最大3レイヤー・通常着弾は最大8対象。飛翔斬撃の吹き飛び画像は1レイヤー最大2体で、通常の敵スプライトとは別に集計する。抑制時は最新1レイヤー。キューで古い演出を除外し、個々のタイムラインはアンマウントで破棄する。 |
| 同時音源 | 予約中を含め最大10音。終了・静寂で発音枠を回収する。Web Audioの発音ノードは発音ごとに生成する。 |

動き軽減のOS設定、低更新頻度のメディアクエリ、討伐画面の低負荷フラグを確認した。討伐ではカメラの揺れ・ズームを停止し、オーラと解放の発光を抑え、粒子を省略する。刹那では決着のカメラ演出を省略し、同じ合図と判定で勝ち抜く。

## バランス調整用設定

| 場所 | 調整対象 |
| --- | --- |
| [huntConfig.ts](../../../src/lib/huntConfig.ts) | チャージの正解・最大コンボ・クリティカル係数、難易度別のクリティカル受付時間、クリティカル表示、過充電時間、チャージ色の切替、従来のサバイバル延長 |
| [enemyApproachConfig.ts](../../../src/lib/enemyApproachConfig.ts) | ステージ座標・更新間隔、敵種別の耐久・速度・接触ダメージ、出現順、難易度別湧き率・増加率・上限、コンボ湧き率、攻撃進化、HPと必殺技 |
| [attackEffects.ts](../../../src/lib/attackEffects.ts) / [battleUi.ts](../../../src/lib/battleUi.ts) | 攻撃の射程表示・時間・色、重複上限、オーラ、構図、ヒット時の揺れ・ズーム、コンボ通知 |
| [releaseConfig.ts](../../../src/lib/releaseConfig.ts) | 解放のKO・飛距離・地球爆破の換算、段階、タイムライン、粒子、振幅、音量・解放音 |
| [setsunaConfig.ts](../../../src/lib/setsunaConfig.ts) | 合図までの待ち時間、CPU反応、再開間隔、お手つき、問題の比率・桁、難易度、段位、強敵抽選・反応、決着演出 |
| [soundConfig.ts](../../../src/lib/soundConfig.ts) | 音量、音程、発音間隔・長さ、環境音、同時発音数 |

設定への移動は元の値を維持した。通常スコアとランキングの再計算式は差分に含まれない。

## 計測方法

Chromium 156.0.8078.79（Linux、Intel Xeon Platinum 8573C、ヘッドレス）から製品ビルドを操作した。PC相当は1280×800とキーボード、モバイル相当は390×844・DPR 2とタッチ入力。低負荷端末相当は同じモバイル設定にCDPの4倍CPUスロットリングと動き軽減を追加した。端末実機と画面表示装置の遅延は未計測。

- 入力は数字の `keydown` / タッチ後の `click` のタイムスタンプから、回答欄のDOM更新と、その後最初の `requestAnimationFrame` までを記録。
- フレーム時間は連続する `requestAnimationFrame` の時刻差。GPU描画完了や入力から物理画面表示までの時間は含まない。
- 討伐は足し算Lv.1・30秒で16回答、刹那は中級で4勝。刹那のフレーム標本は対戦間も含む。解放は開始から終了まで別に集計し、解放の標本にはスクリーンショット撮影を含む。上限到達時の確認は自動テストを参照。
- 集計はミリ秒。p95は実測標本のnearest-rank法。Issue本文に性能の数値基準がないため、計測値を記録した。

再現手順

```sh
npm ci
npm run build
npm --prefix benchmarks/rendering ci
npm run preview -- --host 127.0.0.1
# 別のターミナル
node benchmarks/rendering/measure-round6.mjs /tmp/ke-sangame-round6
```

## 計測結果

| 構成 | モード | 数字入力の標本数 | DOM更新 p95 | 次のフレーム p95 | フレーム間隔 p50 / p95 | 解放フレーム間隔 p50 / p95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| desktop | 討伐 | 24 | 6.40 | 34.40 | 16.70 / 33.30 | 16.70 / 16.80 |
| desktop | 刹那 | 4 | 1.90 | 17.70 | 16.70 / 16.80 | — |
| mobile | 討伐 | 27 | 38.20 | 46.00 | 16.70 / 16.70 | 16.70 / 33.30 |
| mobile | 刹那 | 5 | 18.80 | 30.20 | 16.70 / 16.80 | — |
| mobile-4x-reduced | 討伐 | 26 | 126.40 | 144.30 | 16.70 / 33.40 | 16.70 / 16.80 |
| mobile-4x-reduced | 刹那 | 4 | 34.60 | 40.00 | 16.70 / 16.80 | — |

上限の観測値、爆発時の粒子数、最大値、フレームの標本数も集計JSONに収録した。[集計JSON](measurements.json)

| 構成 | 討伐 | 解放 | 刹那 |
| --- | --- | --- | --- |
| desktop | [プレイ中](desktop-hunt.png) | [爆発](desktop-release.png) | [勝利](desktop-setsuna.png) |
| mobile | [プレイ中](mobile-hunt.png) | [爆発](mobile-release.png) | [勝利](mobile-setsuna.png) |
| mobile-4x-reduced | [プレイ中](mobile-4x-reduced-hunt.png) | [爆発](mobile-4x-reduced-release.png) | [勝利](mobile-4x-reduced-setsuna.png) |

## コマンドの結果

- `npm test` は15ファイル・249件すべて成功。
- `npm run build` と `npm run lint` は成功。
- ランキングSQLの回帰テストは成功。

[テスト・ビルド・lintのログ](npm-checks.txt) · [ランキングSQLのログ](ranking-sql.txt)
