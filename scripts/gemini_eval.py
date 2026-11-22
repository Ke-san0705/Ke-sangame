#!/usr/bin/env python3
"""Gemini評価スクリプト（GitHub Actions用、Python標準ライブラリのみ）。

Issue #10「Gemini評価の自動化」の実装。workflow_dispatch から呼ばれ、
リポジトリ内の対象ファイルを Gemini API で評価し、以下を出力する。

- comment.md   : 対象 Issue へ投稿するコメント本文
- usage-row.md : docs/usage-log.md へ追記する台帳の1行
- result.json  : 使用モデルとトークン数の機械可読な記録

環境変数:
  GEMINI_API_KEY   Secrets から渡される API キー（必須。値は表示・記録しない）
  GEMINI_API_BASE  任意。API のベース URL（既定: https://generativelanguage.googleapis.com）
  GEMINI_RETRY_SLEEP 任意。429/503 時のリトライ間隔秒（既定: 20）
  RUN_URL          任意。Actions 実行ページの URL（コメント末尾に記載）

使い方:
  python3 scripts/gemini_eval.py --issue 10 --target docs/design/dev-form-v2.md [--focus "観点"] [--out-dir gemini-eval-output]
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# 第一候補は gemini-3.5-flash。404（提供終了）や 503 が続く場合は
# flash-lite 系へフォールバックする（2026-11-22 時点の提供状況に基づく）。
MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
DEFAULT_BASE = "https://generativelanguage.googleapis.com"
TARGET_CHAR_LIMIT = 60000   # 評価対象ファイルの読み取り上限（文字数）
COMMENT_CHAR_LIMIT = 30000  # Issue コメントに載せる評価文の上限（文字数）
REQUEST_TIMEOUT = 180       # 秒。gemini-3.5-flash は応答が遅いことがある
JST = timezone(timedelta(hours=9))

PROMPT_TEMPLATE = """あなたはソフトウェア開発プロジェクトの評価担当AI（Gemini）です。
以下の成果物を、開発形態ドキュメント（docs/design/dev-form-v2.md）のSTEP評価の観点で評価してください。

評価の観点:
1. 仕様・設計との適合（目的に対して内容が合っているか）
2. 抜け漏れ・実現可能性（不足している要素、実現が難しい点）
3. リスク（運用・保守・コスト面の懸念）
4. 変更案（具体的な改善提案。設計そのものを変える提案は「設計変更級」と明記すること）

出力形式（Markdown）:
## 総合評価
（3〜5行で要約）
## 良い点
- （箇条書き）
## 指摘事項
- [重大度: 高/中/低] （指摘内容と根拠）
## 変更案
- （箇条書き。なければ「なし」と書く）

{focus_block}評価対象: {target}（Issue #{issue} に関連）

--- 評価対象の内容ここから ---
{content}
--- 評価対象の内容ここまで ---
"""


class GeminiError(Exception):
    def __init__(self, model, status, detail):
        super().__init__(f"{model}: HTTP {status}: {detail}")
        self.model = model
        self.status = status


def call_gemini(model, prompt, api_key, base):
    """generateContent を1回呼び、(本文, usageMetadata) を返す。"""
    url = f"{base}/v1beta/models/{model}:generateContent"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:300]
        raise GeminiError(model, e.code, detail) from e
    except urllib.error.URLError as e:
        raise GeminiError(model, 0, str(e.reason)) from e

    candidates = result.get("candidates") or []
    if not candidates:
        raise GeminiError(model, 200, f"no candidates: {json.dumps(result)[:300]}")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise GeminiError(model, 200, "empty response text")
    return text, result.get("usageMetadata", {})


def evaluate(prompt, api_key, base):
    """モデル候補を順に試し、最初に成功した (モデル, 本文, usage) を返す。"""
    retry_sleep = float(os.environ.get("GEMINI_RETRY_SLEEP", "20"))
    errors = []
    for model in MODELS:
        for attempt in (1, 2):
            try:
                text, usage = call_gemini(model, prompt, api_key, base)
                return model, text, usage
            except GeminiError as e:
                errors.append(str(e))
                print(f"[warn] {e}", file=sys.stderr)
                # 429/503 は同じモデルで1回だけリトライ。それ以外（404等）は次のモデルへ。
                if e.status in (429, 503) and attempt == 1:
                    time.sleep(retry_sleep)
                    continue
                break
    raise SystemExit("Gemini API の全モデルで評価に失敗しました:\n" + "\n".join(errors))


def main():
    parser = argparse.ArgumentParser(description="Gemini による成果物評価")
    parser.add_argument("--issue", required=True, help="結果を投稿する Issue 番号")
    parser.add_argument("--target", required=True, help="評価対象ファイルのパス（リポジトリ内）")
    parser.add_argument("--focus", default="", help="評価観点・追加の指示（任意）")
    parser.add_argument("--out-dir", default="gemini-eval-output", help="出力先ディレクトリ")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("環境変数 GEMINI_API_KEY が設定されていません（Secrets を確認してください）")
    base = os.environ.get("GEMINI_API_BASE", DEFAULT_BASE).rstrip("/")
    run_url = os.environ.get("RUN_URL", "")

    target_path = Path(args.target)
    if not target_path.is_file():
        raise SystemExit(f"評価対象ファイルが見つかりません: {args.target}")
    content = target_path.read_text(encoding="utf-8")
    truncated_note = ""
    if len(content) > TARGET_CHAR_LIMIT:
        content = content[:TARGET_CHAR_LIMIT]
        truncated_note = f"\n（注: ファイルが大きいため先頭 {TARGET_CHAR_LIMIT} 文字のみを評価対象にしました）"

    focus_block = ""
    if args.focus.strip():
        focus_block = f"追加の指示・重点観点: {args.focus.strip()}\n\n"
    prompt = PROMPT_TEMPLATE.format(
        focus_block=focus_block, target=args.target, issue=args.issue, content=content
    ) + truncated_note

    model, text, usage = evaluate(prompt, api_key, base)
    prompt_tokens = usage.get("promptTokenCount", "-")
    output_tokens = usage.get("candidatesTokenCount", "-")
    total_tokens = usage.get("totalTokenCount", "-")
    thoughts_tokens = usage.get("thoughtsTokenCount")

    comment_text = text
    if len(comment_text) > COMMENT_CHAR_LIMIT:
        comment_text = comment_text[:COMMENT_CHAR_LIMIT] + "\n\n（長文のため一部を省略しました）"

    run_line = f"- 実行: {run_url}\n" if run_url else ""
    comment = (
        "## Gemini評価（自動実行）\n\n"
        f"- 対象: `{args.target}`\n"
        f"- 使用モデル: {model}\n"
        f"- トークン使用量: 入力 {prompt_tokens} / 出力 {output_tokens} / 合計 {total_tokens}\n"
        f"{run_line}\n"
        f"{comment_text}\n\n"
        "---\n"
        "このコメントは Issue #10 の自動化ワークフロー（Gemini評価）が投稿しました。"
        "提案の採否は Muse が取捨し、設計変更級の提案はオーナーへ上げます。"
    )

    today = datetime.now(JST).strftime("%Y-%m-%d")
    thoughts_note = f"思考トークン {thoughts_tokens} を含む。" if thoughts_tokens else ""
    run_note = f"実行: {run_url}" if run_url else "GitHub Actions で自動記録"
    usage_row = (
        f"| {today} | - | Gemini API | Issue #{args.issue} の評価（{args.target}） "
        f"| {model} | {prompt_tokens} | {output_tokens} "
        f"| 合計{total_tokens}トークン。{thoughts_note}{run_note} |"
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "comment.md").write_text(comment + "\n", encoding="utf-8")
    (out_dir / "usage-row.md").write_text(usage_row + "\n", encoding="utf-8")
    (out_dir / "result.json").write_text(
        json.dumps(
            {
                "issue": args.issue,
                "target": args.target,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "thoughts_tokens": thoughts_tokens,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"評価完了: model={model} total_tokens={total_tokens}")


if __name__ == "__main__":
    main()
