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

PRモード（pull_request トリガー用）:
  python3 scripts/gemini_eval.py --pr 21 [--repo owner/repo] [--focus "観点"] [--out-dir gemini-eval-output]
  PRの差分を GitHub API から取得して評価し、同じ3ファイルを出力する
  （投稿はワークフロー側の `gh pr comment` で行う）。
  追加の環境変数:
    GH_TOKEN / GITHUB_TOKEN  GitHub API 用トークン（PR情報・差分の取得に使用）
    GITHUB_REPOSITORY         owner/repo（Actions が自動設定。--repo で上書き可）
    GITHUB_API_BASE            任意。GitHub API のベース URL（既定: https://api.github.com）
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

PR_PROMPT_TEMPLATE = """あなたはソフトウェア開発プロジェクトの評価担当AI（Gemini）です。実装者ではない第三者レビュアーとして、以下の Pull Request の差分を、開発形態ドキュメント（docs/design/dev-form-v2.md）§6.1 のSTEP 5評価観点でレビューしてください。

評価の観点:
1. 仕様適合（関連する設計書・Issue の完了条件を満たしているか。満たしていないものを列挙）
2. UI適合（モックとの差異。該当する場合のみ）
3. リスク（不具合・保守性・セキュリティ・運用面の懸念）
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

推測で仕様を広げないこと。

{focus_block}評価対象: PR #{pr}「{title}」の差分

--- 差分ここから ---
{content}
--- 差分ここまで ---
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


def github_get(path, token, base, accept):
    """GitHub API を GET し、本文テキストを返す。"""
    request = urllib.request.Request(
        f"{base}{path}",
        headers={
            "Accept": accept,
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"GitHub API の取得に失敗しました: GET {path}: HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"GitHub API の取得に失敗しました: GET {path}: {e.reason}") from e


def fetch_pr_diff(repo, pr_number):
    """PR のタイトルと差分テキストを GitHub API から取得する。"""
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("環境変数 GH_TOKEN（または GITHUB_TOKEN）が設定されていません（PR差分の取得に必要です）")
    base = (
        os.environ.get("GITHUB_API_BASE") or os.environ.get("GITHUB_API_URL") or "https://api.github.com"
    ).rstrip("/")
    meta = json.loads(github_get(f"/repos/{repo}/pulls/{pr_number}", token, base, "application/vnd.github+json"))
    diff = github_get(f"/repos/{repo}/pulls/{pr_number}", token, base, "application/vnd.github.diff")
    return meta.get("title", ""), diff


def main():
    parser = argparse.ArgumentParser(description="Gemini による成果物評価")
    parser.add_argument("--issue", help="結果を投稿する Issue 番号（ファイル評価モード）")
    parser.add_argument("--target", help="評価対象ファイルのパス（リポジトリ内、ファイル評価モード）")
    parser.add_argument("--pr", type=int, help="評価対象の PR 番号（PRモード：差分を評価）")
    parser.add_argument("--repo", default="", help="owner/repo（PRモード用。既定は環境変数 GITHUB_REPOSITORY）")
    parser.add_argument("--focus", default="", help="評価観点・追加の指示（任意）")
    parser.add_argument("--out-dir", default="gemini-eval-output", help="出力先ディレクトリ")
    args = parser.parse_args()

    if args.pr and (args.issue or args.target):
        parser.error("--pr と --issue/--target は同時に指定できません")
    if not args.pr and not (args.issue and args.target):
        parser.error("ファイル評価モードでは --issue と --target、PRモードでは --pr を指定してください")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("環境変数 GEMINI_API_KEY が設定されていません（Secrets を確認してください）")
    base = os.environ.get("GEMINI_API_BASE", DEFAULT_BASE).rstrip("/")
    run_url = os.environ.get("RUN_URL", "")

    focus_block = ""
    if args.focus.strip():
        focus_block = f"追加の指示・重点観点: {args.focus.strip()}\n\n"

    pr_title = ""
    if args.pr:
        repo = args.repo or os.environ.get("GITHUB_REPOSITORY", "")
        if "/" not in repo:
            raise SystemExit("PRモードには owner/repo が必要です（--repo または環境変数 GITHUB_REPOSITORY）")
        pr_title, content = fetch_pr_diff(repo, args.pr)
        subject_label = f"PR #{args.pr} の評価（PR差分）"
        target_display = f"PR #{args.pr}「{pr_title}」"
        step_label = "STEP 5"
        footer = (
            "このコメントは自動化ワークフロー（Gemini評価、PRトリガー）が投稿しました。"
            "提案の採否は Muse が取捨し、設計変更級の提案はオーナーへ上げます。"
        )
        content_kind = "差分"
    else:
        target_path = Path(args.target)
        if not target_path.is_file():
            raise SystemExit(f"評価対象ファイルが見つかりません: {args.target}")
        content = target_path.read_text(encoding="utf-8")
        subject_label = f"Issue #{args.issue} の評価（{args.target}）"
        target_display = f"`{args.target}`"
        step_label = "-"
        footer = (
            "このコメントは Issue #10 の自動化ワークフロー（Gemini評価）が投稿しました。"
            "提案の採否は Muse が取捨し、設計変更級の提案はオーナーへ上げます。"
        )
        content_kind = "ファイル"

    truncated_note = ""
    if len(content) > TARGET_CHAR_LIMIT:
        content = content[:TARGET_CHAR_LIMIT]
        truncated_note = f"\n（注: {content_kind}が大きいため先頭 {TARGET_CHAR_LIMIT} 文字のみを評価対象にしました）"

    if args.pr:
        prompt = PR_PROMPT_TEMPLATE.format(
            focus_block=focus_block, pr=args.pr, title=pr_title, content=content
        ) + truncated_note
    else:
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
        f"- 対象: {target_display}\n"
        f"- 使用モデル: {model}\n"
        f"- トークン使用量: 入力 {prompt_tokens} / 出力 {output_tokens} / 合計 {total_tokens}\n"
        f"{run_line}\n"
        f"{comment_text}\n\n"
        "---\n"
        f"{footer}"
    )

    today = datetime.now(JST).strftime("%Y-%m-%d")
    thoughts_note = f"思考トークン {thoughts_tokens} を含む。" if thoughts_tokens else ""
    run_note = f"実行: {run_url}" if run_url else "GitHub Actions で自動記録"
    usage_row = (
        f"| {today} | {step_label} | Gemini API | {subject_label} "
        f"| {model} | {prompt_tokens} | {output_tokens} "
        f"| 合計{total_tokens}トークン。{thoughts_note}{run_note} |"
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "comment.md").write_text(comment + "\n", encoding="utf-8")
    (out_dir / "usage-row.md").write_text(usage_row + "\n", encoding="utf-8")
    result = {
        "model": model,
        "prompt_tokens": prompt_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "thoughts_tokens": thoughts_tokens,
    }
    if args.pr:
        result.update({"mode": "pr", "pr": args.pr, "repo": repo, "title": pr_title})
    else:
        result.update({"mode": "file", "issue": args.issue, "target": args.target})
    (out_dir / "result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"評価完了: model={model} total_tokens={total_tokens}")


if __name__ == "__main__":
    main()
