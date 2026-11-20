# 計算無双（Ke-sangame）

小学生・中高生向けに、計算力を鍛えるWebアプリです。寿司打のように気軽に開いて、制限時間内に次々と計算問題を解くタイムアタック形式を目指しています。

## コンセプト
- 開いてすぐ遊べる（ログインなしで全機能が遊べる）
- 演算は選択式（当面は四則演算）、レベルは5段階（L1：小学校低学年 〜 L5：とにかく難しく）
- 入力はPC＝キーボード、スマホ＝オリジナルの画面テンキー
- スコア表示とオンラインランキング（任意・ニックネームのみ）
- スマホ／PC両対応。将来のアプリ化に備えPWA対応予定

## ドキュメント
- 開発形態（GitHub Issue駆動のAI開発）：`docs/design/dev-form-v2.md`
- STEP 0 確定仕様：`docs/design/step0-spec.md`
- 設計書 v1：`docs/design/design-v1.md`
- 決定ログ：`docs/decisions/`
- AI使用量台帳：`docs/usage-log.md`

## 開発体制
GitHub Issueを中心に、Codex（実装主軸）／Gemini（STEP毎の評価・提案）／Muse（設計・Issue監視と操作・統括）で開発します。人間の役割はアイデア出し、設計変更への判断（8時間ルール）、最終承認です。詳細は `docs/design/dev-form-v2.md` を参照してください。
