# 計算無双（Ke-sangame）

小学生・中高生向けに、計算力を鍛えるWebアプリです。寿司打のように気軽に開いて、制限時間内に次々と計算問題を解くタイムアタック形式を目指しています。

## コンセプト
- 開いてすぐ遊べる（ログインなしで全機能が遊べる）
- 演算は選択式（当面は四則演算）、レベルは5段階（L1：小学校低学年 〜 L5：とにかく難しく）
- 入力はPC＝キーボード、スマホ＝オリジナルの画面テンキー
- スコア表示とオンラインランキング（任意・ニックネームのみ）
- スマホ／PC両対応。PWAとしてホーム画面に追加し、オフラインでもプレイ可能

## ドキュメント
- 開発形態（GitHub Issue駆動のAI開発）：`docs/design/dev-form-v2.md`
- STEP 0 確定仕様：`docs/design/step0-spec.md`
- 設計書 v1：`docs/design/design-v1.md`
- 決定ログ：`docs/decisions/`
- AI使用量台帳：`docs/usage-log.md`

## 開発体制
GitHub Issueを中心に、Codex（実装主軸）／Gemini（STEP毎の評価・提案）／Muse（設計・Issue監視と操作・統括）で開発します。人間の役割はアイデア出し、設計変更への判断（8時間ルール）、最終承認です。詳細は `docs/design/dev-form-v2.md` を参照してください。

## ローカル開発

Node.js 24 LTS を推奨します。

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

開発サーバーの既定 URL は `http://localhost:5173/Ke-sangame/` です。
画面は `src/components/`、出題生成やスコア計算などのロジックは `src/lib/` に配置します。

本番用の静的ファイルは `dist/` に生成されます。GitHub Pages 用の base は
`/Ke-sangame/` です。PWA は `npm run build` の後に `npm run preview` で確認できます。
Service Worker は本番ビルドで登録されます。初回はオンラインで開き、キャッシュの
準備が完了するとオフラインでも再訪してプレイできます。

## GitHub Pages への公開

リポジトリの **Settings → Pages → Build and deployment → Source** で
**GitHub Actions** を選択します。`main` への push または `main` を選んだ
手動実行で、テスト・lint・ビルドを通過した `dist/` が公開されます。

公開先は [計算無双](https://ke-san0705.github.io/Ke-sangame/) です。公開後は PC と
スマホで次の手順を確認します。

1. オンラインで公開 URL を開いてプレイし、ランキング一覧を表示する。
2. Android の Chrome ではブラウザーのメニューからインストールし、iOS の Safari
   では共有メニューから「ホーム画面に追加」を選ぶ。追加したアイコンから起動する。
3. 初回の読み込み後、通信を切り、公開 URL を再度開くか追加したアイコンから起動する。
   新しくプレイを開始し、結果画面まで進めることを確認する。

## ランキング基盤（Supabase）

Supabase の無料プロジェクトの SQL Editor で
`supabase/migrations/20261121000000_ranking_foundation.sql` を適用します。
クライアントを接続する際は、`.env.example` をもとに `.env.local` の
`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` にプロジェクト URL と公開用の
`anon` キーを設定します。管理キーは Vite の環境変数に設定しません。
アプリの起動にランキングの設定や通信は不要です。

| RPC | 引数 |
| --- | --- |
| `submit_ranking_score` | `p_nickname`、`p_operation`、`p_level`、`p_duration_seconds`、`p_correct_count`、`p_miss_count`、`p_device_id` |
| `get_rankings` | `p_operation`、`p_level`、`p_duration_seconds`、任意の `p_limit`（既定50、1〜100件） |

演算は `add`（足し算）、`subtract`（引き算）、`multiply`（掛け算）、
`divide`（割り算）、`mix`（ミックス）、レベルは1〜5、制限時間は30・60・120秒です。
どちらの RPC も `id`、`nickname`、`score`、`submitted_at` を含む配列を返します。
取得順はスコアの降順、同点は登録の早い順です。

端末 ID はブラウザーで `crypto.randomUUID()` を使って一度作り、同じ UUID を
`localStorage` から再利用します。登録間隔が30秒未満の場合は HTTP 429 を返します。
この制限は端末 ID 単位で、ストレージを削除すると別の端末 ID として扱われます。
オフラインで開始したプレイの結果はクライアント側で登録対象外にし、事後送信しません。

正解数は制限時間×5、正解数とミス数の合計は制限時間×10を上限とします。
正確率係数は100%で1.2、90%以上100%未満で1.1、90%未満で1.0です。
正解数とミス数がともに0の場合、スコアは0点です。
ニックネームは前後の空白を除いて1〜10文字とし、NGワード照合では NFKC 正規化と
小文字化を行います。NGワードは DB の `ranking_blocked_words` で管理します。

DB の動作確認は、マイグレーション適用済みのテスト用 Supabase に対して
`psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ranking.sql` を実行します。
テストは匿名ロールから RPC を呼び、最後にテストデータをロールバックします。
