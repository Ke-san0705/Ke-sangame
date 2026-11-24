# グラフィック素材台帳

[グラフィック制作基準](graphic-assets.md)に基づく。素材の追加・差し替え時は、ファイルまたはレイヤーごとに行を追加・更新する。制作条件には使用ツール・モデル、プロンプトや原画の記録先、加工内容を記録する。利用許諾には利用範囲・クレジット条件・根拠を記録し、確認できない項目には「未確認」と記す。

| ファイル（リポジトリ相対） | 由来・根拠 | 利用許諾 | 制作条件 | 実寸（px） | アンカー（px、左上原点） | 適合評価・対応 |
| --- | --- | --- | --- | --- | --- | --- |
| `public/…` | 制作者・入手先・コミット | 条件と証跡 | ツール・モデル・原画・加工 | 幅×高さ | 足元中央またはレイヤー原点 | 判定・理由・修正内容 |

## 初期素材（DEV-03b）

全点を**プレースホルダー**として登録する。人物と背景は本Issueのために作成したオリジナルの試作。敵4体は既存の静止画から透過範囲の切り出し、縮小、平行移動、回転、伸縮で作成した仮アニメーション。スライムは右向きへ反転済み。ゴブリンとゴーレムの正面寄りの構図は原画に由来する。敵の歩行や攻撃には手足・武器を個別に描き起こした原画が必要。

シートと対応するJSONは `public/assets/initial/characters/` に配置。`cell`、`grid`、フレーム範囲、fps、アンカーは同梱JSONで指定する。画像・セルともに左上 (0, 0) が原点。アンカーはセル内の足元中央で、動作を通して共通。

| 素材・PNG | JSON | 由来／制作条件 | 利用許諾 | シート／セル (px) | アンカー (px) |
| --- | --- | --- | --- | --- | --- |

| [魔法剣士](../public/assets/initial/characters/spellblade.png) | [定義](../public/assets/initial/characters/spellblade.json) | DEV-03b・Pillow 13.0.0 の図形描画で新規制作 | 本リポジトリ向けの新規制作 | 1024×640／128×128 | (64, 112) |
| [侍](../public/assets/initial/characters/samurai.png) | [定義](../public/assets/initial/characters/samurai.json) | DEV-03b・Pillow 13.0.0 の図形描画で新規制作 | 本リポジトリ向けの新規制作 | 1024×768／128×128 | (64, 112) |
| [敵剣士](../public/assets/initial/characters/enemy-swordsman.png) | [定義](../public/assets/initial/characters/enemy-swordsman.json) | DEV-03b・Pillow 13.0.0 の図形描画で新規制作 | 本リポジトリ向けの新規制作 | 1024×768／128×128 | (64, 112) |
| [剣豪](../public/assets/initial/characters/swordmaster.png) | [定義](../public/assets/initial/characters/swordmaster.json) | DEV-03b・Pillow 13.0.0 の図形描画で新規制作 | 本リポジトリ向けの新規制作 | 1024×768／128×128 | (64, 112) |
| [スライム](../public/assets/initial/characters/slime.png) | [定義](../public/assets/initial/characters/slime.json) | M・[既存静止画](../public/monsters/slime.png) を Pillow 13.0.0 で加工 | 確認済み（Gemini画像生成、2026-11-23。生成チャット https://gemini.google.com/app/9ce22c062ffd0de7 で確認） | 512×320／64×64 | (32, 56) |
| [ゴブリン](../public/assets/initial/characters/goblin.png) | [定義](../public/assets/initial/characters/goblin.json) | M・[既存静止画](../public/monsters/goblin.png) を Pillow 13.0.0 で加工 | 確認済み（Gemini画像生成、2026-11-23。生成チャット https://gemini.google.com/app/9ce22c062ffd0de7 で確認） | 768×480／96×96 | (48, 84) |
| [オオカミ](../public/assets/initial/characters/wolf.png) | [定義](../public/assets/initial/characters/wolf.json) | M・[既存静止画](../public/monsters/wolf.png) を Pillow 13.0.0 で加工 | 確認済み（Gemini画像生成、2026-11-23。生成チャット https://gemini.google.com/app/9ce22c062ffd0de7 で確認） | 896×560／112×112 | (56, 98) |
| [ゴーレム](../public/assets/initial/characters/golem.png) | [定義](../public/assets/initial/characters/golem.json) | M・[既存静止画](../public/monsters/wood-golem.png) を Pillow 13.0.0 で加工 | 確認済み（Gemini画像生成、2026-11-23。生成チャット https://gemini.google.com/app/9ce22c062ffd0de7 で確認） | 1536×960／192×192 | (96, 168) |

背景は Pillow 13.0.0 の図形描画でこのリポジトリ向けに新規制作。低彩度の配色で、遠景から中景、地面の順に重ねる。全レイヤー共通の左上が原点・配置アンカー。

| 素材・PNG | 用途 | 実寸 (px) | アンカー (px) |
| --- | --- | --- | --- |
| [草原・遠景](../public/assets/initial/backgrounds/grassland/far.png) | 討伐用 | 640×360 | (0, 0) |
| [草原・中景](../public/assets/initial/backgrounds/grassland/mid.png) | 討伐用 | 640×360 | (0, 0) |
| [草原・地面](../public/assets/initial/backgrounds/grassland/ground.png) | 討伐用 | 640×360 | (0, 0) |
| [夕暮れの平原・遠景](../public/assets/initial/backgrounds/sunset-plain/far.png) | 刹那用 | 640×360 | (0, 0) |
| [夕暮れの平原・中景](../public/assets/initial/backgrounds/sunset-plain/mid.png) | 刹那用 | 640×360 | (0, 0) |
| [夕暮れの平原・地面](../public/assets/initial/backgrounds/sunset-plain/ground.png) | 刹那用 | 640×360 | (0, 0) |

DEV-10 で侍・敵剣士の各シートに納刀時の 46 コマ目を追加した。既存の構えを Pillow で加工し、刀身を消して手元を鞘の位置に合わせた。寸法と足元アンカーは各 JSON の `sheathed` に記載。

### コマ別確認画像

各行はひとつの動作。数字はJSONのフレーム番号、横線は足元アンカーの高さ。人物は衣装・剣の持ち手・姿勢の推移、敵は輪郭・武器や四肢の欠けを確認。ゴブリンの強攻撃で右端に達したフレームは、縮小率と移動幅を調整して修正した。最終アートの合格判定は未実施。

[魔法剣士](assets/dev-03b/spellblade.jpg) · [侍](assets/dev-03b/samurai.jpg) · [敵剣士](assets/dev-03b/enemy-swordsman.jpg) · [剣豪](assets/dev-03b/swordmaster.jpg) · [スライム](assets/dev-03b/slime.jpg) · [ゴブリン](assets/dev-03b/goblin.jpg) · [オオカミ](assets/dev-03b/wolf.jpg) · [ゴーレム](assets/dev-03b/golem.jpg) · [背景の合成と各レイヤー](assets/dev-03b/backgrounds.jpg)

## 既存素材の判定

- **仮素材として利用可**は、現行の静止画表示やレイアウトの確認に使えるという規格上の評価。既存素材の利用許諾の確認は別途必要。
- **刷新が必要**は、新しい描画で本採用する前に規格に沿った素材へ差し替える必要があるという判定。既存21点はいずれも該当する。
- 寸法と画像形式をファイルから確認し、全点の構図を目視で確認した。既存画像に足元アンカーや背景レイヤーの配置データは登録されていない。

### キャラクター17体

**M** は [#47](https://github.com/Ke-san0705/Ke-sangame/issues/47) と[追加コミット](https://github.com/Ke-san0705/Ke-sangame/commit/bba081b6e33d45b60a5b4b2348e1a9231fc01035)を指す。Issue では Gemini 画像生成を制作条件として指定。個別のモデル、プロンプト、加工履歴は未確認。全点に透過があり、各ファイルは静止画1枚。全点で所定寸法の均一セルを持つシートと足元中央アンカーの設定が必要。

| ファイル | 由来 | 利用許諾 | 制作条件 | 実寸 | アンカー | 仮素材判定 | 正式採用の判定と対応 |
| --- | --- | --- | --- | --- | --- | --- |
| [`public/monsters/baby-dragon.png`](../public/monsters/baby-dragon.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き。右向き原画と空中ポーズの基準点を用意 |
| [`public/monsters/dark-mage.png`](../public/monsters/dark-mage.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。正面寄り。右向きの構えを用意 |
| [`public/monsters/death-knight.png`](../public/monsters/death-knight.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き。右向き原画と剣の収まるセルを用意 |
| [`public/monsters/demon-king.png`](../public/monsters/demon-king.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。正面寄り。右向きの構えとマントの収まるセルを用意 |
| [`public/monsters/dragon.png`](../public/monsters/dragon.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き。翼と尾の収まるセルを用意 |
| [`public/monsters/gargoyle.png`](../public/monsters/gargoyle.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き。翼の動きが収まるセルを用意 |
| [`public/monsters/goblin.png`](../public/monsters/goblin.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き寄り。通常敵の枠で剣・盾と足位置を統一 |
| [`public/monsters/hellhound.png`](../public/monsters/hellhound.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き。右向きの四足用ポーズを用意 |
| [`public/monsters/hero.png`](../public/monsters/hero.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き寄り。5〜6頭身・128×128 の主人公へ差し替え |
| [`public/monsters/mushroom.png`](../public/monsters/mushroom.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。正面寄り。右向きの小型敵用セルを用意 |
| [`public/monsters/reaper.png`](../public/monsters/reaper.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き寄り。鎌と浮遊姿勢の基準点を統一 |
| [`public/monsters/skeleton.png`](../public/monsters/skeleton.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き寄り。剣・盾と足位置を統一 |
| [`public/monsters/slime.png`](../public/monsters/slime.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き寄り。右向きの小型敵用セルを用意 |
| [`public/monsters/tiger-cub.png`](../public/monsters/tiger-cub.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き。右向きの四足用ポーズを用意 |
| [`public/monsters/treant.png`](../public/monsters/treant.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。左向き寄り。右向き原画と浮遊姿勢の基準点を用意 |
| [`public/monsters/wolf.png`](../public/monsters/wolf.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。右向き。通常敵の枠で四足の接地を統一 |
| [`public/monsters/wood-golem.png`](../public/monsters/wood-golem.png) | M | 確認済み（Gemini画像生成、2026-11-23） | M の制作条件 | 512×512 | 未設定 | 仮素材として利用可 | 刷新が必要。正面寄り。右向きの大型敵用セルを用意 |

### 背景4点

**B** は [#70](https://github.com/Ke-san0705/Ke-sangame/issues/70) と[追加コミット](https://github.com/Ke-san0705/Ke-sangame/commit/feebe798d968c1ae86bd3912075da09d574adc95)を指す。Issue ではプロジェクト側でドット絵を生成する方針。個別の生成ツール、モデル、プロンプト、加工履歴は未確認。全点が単一の JPEG で、640×360 の遠景・中景・地面へ刷新が必要。

| ファイル | 由来 | 利用許諾 | 制作条件 | 実寸 | アンカー | 仮素材判定 | 正式採用の判定と対応 |
| --- | --- | --- | --- | --- | --- | --- |
| [`public/stages/demon-castle.jpg`](../public/stages/demon-castle.jpg) | B | 未確認 | B の制作条件 | 1600×893 | 左上 (0, 0)、単一画像 | 仮素材として利用可 | 刷新が必要。空・城・手前の地面を分割 |
| [`public/stages/dungeon.jpg`](../public/stages/dungeon.jpg) | B | 未確認 | B の制作条件 | 1600×893 | 左上 (0, 0)、単一画像 | 仮素材として利用可 | 刷新が必要。奥の通路・アーチ・床を分割 |
| [`public/stages/forest.jpg`](../public/stages/forest.jpg) | B | 未確認 | B の制作条件 | 1600×893 | 左上 (0, 0)、単一画像 | 仮素材として利用可 | 刷新が必要。奥の木々・中景の樹木・地面を分割 |
| [`public/stages/grassland.jpg`](../public/stages/grassland.jpg) | B | 未確認 | B の制作条件 | 1600×893 | 左上 (0, 0)、単一画像 | 仮素材として利用可 | 刷新が必要。空・丘・草原の地面を分割し、UI 背面の明度を確認 |
