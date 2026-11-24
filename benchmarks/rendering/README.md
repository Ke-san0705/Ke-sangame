# DEV-01 描画方式の比較

## 結果

敵50体＋粒子200個のシーンでは、DOM/CSS と PixiJS のフレーム間隔は同等だった。入力受付の p95 はこの環境では DOM/CSS が 1.7 ms、PixiJS が 6.3 ms。視覚フィードバックの p95 は約32 msで同水準だった。今回の負荷では描画方式の変更を支持する改善が観測されなかったため、既存の DOM/CSS を継続する。

| 指標（ms） | DOM/CSS p50 | DOM/CSS p95 | DOM/CSS 最大 | PixiJS p50 | PixiJS p95 | PixiJS 最大 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| フレーム間隔 | 16.70 | 16.80 | 16.80 | 16.70 | 16.80 | 16.80 |
| 入力受付 | 0.40 | 1.70 | 4.20 | 0.50 | 6.30 | 10.90 |
| 入力→視覚反映の近似 | 25.55 | 31.80 | 34.20 | 25.15 | 32.80 | 33.50 |

2026-11-24に Linux クラウド環境（AMD EPYC 9V74、CPU クォータ2コア）で測定。Chromium 156.0.8078.79 のヘッドレスモード、900×600、DPR 1。PixiJS 8.23.0 は WebGL/ANGLE（SwiftShader によるソフトウェア描画）で動作した。描画領域は720×480。両方式とも20 msを超えるフレーム間隔は0件だった（DOM/CSS 804サンプル、PixiJS 807サンプル）。入力は各方式90件。p50 は中央値、p95 は最近順位法で、各方式の3試行をまとめて算出した。

## 手順

このディレクトリは独立した検証ページ。PixiJS はこのページ用のパッケージにだけ含まれる。

リポジトリのルートから、端末1で以下を実行する。

```sh
npm --prefix benchmarks/rendering ci
npm --prefix benchmarks/rendering run start -- --host 127.0.0.1 --port 4174 --strictPort
```

端末2で計測する。Chromium のパスは `CHROMIUM_PATH`、URL は `BENCHMARK_URL` で上書きできる。

```sh
npm --prefix benchmarks/rendering run --silent measure > rendering-measurements.json
```

ブラウザでページを開くと DOM/CSS と PixiJS を切り替えられる。どちらも同じゲーム内スプライト、固定シード、座標・透過率の更新処理を使う。Space を押すと1体の敵の表示が変わる。DOM/CSS 側は既存の画像要素・CSS の描画方式を再現した負荷シーン。

- フレーム間隔は連続する `requestAnimationFrame` の時刻差。画面更新のペースを測り、GPU の描画処理単体の時間とは区別する。
- 入力受付はブラウザに送ったキーイベントの `timeStamp` から共通ハンドラーの実行開始まで。
- 視覚反映の近似はイベント時刻から、変化を描画した次の `requestAnimationFrame` の開始まで。物理デバイスの入力やディスプレイの表示時刻は測定範囲外。
- 方式ごとに新しいページで1.5秒ウォームアップし、キー入力を30回送る。順番を DOM→Pixi→Pixi→DOM→DOM→Pixi とし、起動順の影響を抑える。

この測定は単一のヘッドレス環境で行った。実機GPUやモバイルでの性能は別途測定が必要。
