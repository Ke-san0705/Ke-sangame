# Issue #102 の Chromium 検証

Chromium で Vite のゲーム画面を開き、モンスター討伐モード、足し算、Lv.1、30秒を選択。表示された計算式を読み取り、数字キーと Enter で回答した。

| 確認項目 | 観測結果 |
| --- | --- |
| 通常斬撃 | [攻撃開始時](slash.jpg) |
| 飛翔斬撃 | [5コンボ](flying.jpg) |
| 衝撃波 | [10コンボ](shockwave.jpg) |
| エネルギー砲 | [30コンボ](cannon.jpg)・[50コンボ](cannon-strong.jpg) |
| 高速入力と計時 | 各回答で次の問題に進み、50コンボに到達。VFX は同時に最大3件。時間切れで [解放画面](release.jpg) に遷移 |
| 低モーション | Chromium の `prefers-reduced-motion` を有効化。連続12問を受け付け、VFX は最大1件。カメラに変形なし。[10コンボ](reduced-motion.jpg) |

両設定でブラウザの実行時例外は0件。
