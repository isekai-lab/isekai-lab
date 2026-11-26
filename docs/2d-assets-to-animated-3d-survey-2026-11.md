# 2Dアセットから動く3Dアセットへの制作方法とエンジン比較

調査基準日：2026年11月25日 JST

ドット絵を原案に、3Dの空間・カメラを使う2.5D RPGを作る方法を比較する。3Dキャラクターはアニメーションできることを必須とし、単一の静的メッシュを作れるだけでは採用条件を満たさない。既存の[ゲームエンジン調査](browser-rpg-engine-survey-2026-11.md)に、表現とアセット制作費の軸を追加する。

## 結論

**2D原案から、部位別のローポリ・ボクセル形状と共通リグを作る案は有力。** ただし、全身の三面図を立体化しただけでは、関節や部位の意味は自動では決まらない。最初から頭・胴・腕・脚等を分け、関節の位置と親子関係を共通の仕様にする必要がある。

今回の第一検証案は、**PlayCanvasまたはGodotで、部位別の3Dキャラを共通リグで動かし、地形・建物には単純な3D形状を使う構成**。TS・ブラウザ中心を維持するならPlayCanvas、リグ・アニメーションをエディタで調整する制作方法も重視するならGodotを比較する。

ただし、現プロジェクトの「TypeScriptのES modulesで開発し、外部通信不要の単体HTMLで配布」を維持する条件では、**PlayCanvasを先に検証する**。Godotの公式対応言語にTypeScriptは含まれず、標準のWeb出力もHTMLとWASM・データ等の複数ファイルを使うため、Godotは開発言語・配布要件を見直す場合の比較候補になる。PlayCanvasも単体HTML化が標準で完了するという意味ではなく、エンジン・モデル・テクスチャの埋め込みとオフライン読み込みを試作で確認する。[PlayCanvasのTS構成](https://developer.playcanvas.com/user-manual/engine/standalone/)、[Godotの対応言語](https://docs.godotengine.org/en/stable/getting_started/step_by_step/scripting_languages.html)、[GodotのWeb出力](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

画像から骨付きモデルを作る生成サービスも、外部API料金だけなら比較できる価格帯にある。小規模な試作では、専用変換器を新規開発する費用がAPI利用との差額を上回る可能性もある。まず既存ツールとサービスで同じ原案を比較し、採用できた「動く一体」までの総費用を記録する。

以下の推奨・適合度は公式資料からの設計評価。生成の実行、課金、同条件の品質・性能測定は行っていない。

## エンジンと表現の二軸

まず、ゲーム内で何を描くかを分ける。制作にAIを使うかどうかは、完成アセットの形式とは別に選べる。

| 表現 | キャラの動かし方 | カメラとの関係 | 制作負担の主な要因 |
|---|---|---|---|
| 2Dマップと2Dキャラ | スプライトのコマ送り等 | 移動・拡大中心 | 方向別・動作別の絵 |
| 3D背景と2Dキャラ | 3D空間に置いた絵をアニメーション | 寄り・移動が可能。回り込みには絵の見え方への配慮 | 複数方向の絵、影、背景とのなじみ |
| 部位別の3Dキャラ | 頭・胴・手足を親子付けして回転、または骨へ固定 | 立体として見られる | 部位形状、関節位置、共通アニメーション |
| スキニングした3Dキャラ | 骨に応じて関節周辺も変形 | 立体として見られる | トポロジー、骨、ウェイト、変形の修正 |

「ボクセル」は形の作り方であり、静物専用という意味ではない。部位別にしたボクセルモデルも動かせる。一方、全身が結合したボクセルモデルを生成するだけでは、上の3・4行目の準備は揃わない。

### 適合度の比較

◎＝今回の構成の有力候補、○＝機能を組み合わせて検討可能、△＝追加連携や検証の負担を重視。速度や品質の実測順位ではない。

| エンジン | 2Dマップと2Dキャラ | 3D背景と2Dキャラ | 部位別3Dと共通リグ | スキニング3D |
|---|---|---|---|---|
| Phaser | ◎ | △ 外部3D層等を比較 | △ 追加3D基盤が必要 | △ 追加3D基盤が必要 |
| PlayCanvas | ○ | ◎ | ◎ | ◎ |
| Godot | ◎ | ◎ | ◎ | ◎ |
| Defold | ◎ | ○ | ○ | ○ |
| Unity | ◎ | ◎ | ◎ | ◎ |
| GDevelop | ◎ | △ 拡張の成熟度を確認 | ○ | ○ モデルと動作の互換確認 |

根拠と条件：

- **PlayCanvas：** 3D・2D機能に加え、アニメーションを扱う。ローカルのJS/TS制作とEditor利用は選べる。[2D機能](https://developer.playcanvas.com/user-manual/2D/)、[Animation](https://developer.playcanvas.com/user-manual/animation/)、[Engine単独利用](https://developer.playcanvas.com/user-manual/engine/standalone/)
- **Godot：** Sprite3Dは3D空間に2D絵を置き、billboardも設定できる。glTFは推奨の3D形式で、シーン・骨・アニメーションを扱える。[Sprite3D](https://docs.godotengine.org/en/stable/classes/class_sprite3d.html)、[3D形式](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)
- **Defold：** 2Dと3Dを混在でき、glTFのモデル・骨・アニメーションを読み込める。アニメーションのベイク等の条件を確認する。[Model](https://defold.com/manuals/model/)、[Importing models](https://defold.com/manuals/importing-models/)
- **Unity：** 2D/3D制作基盤として比較できるが、スマホWebの配信量・起動・メモリは別途実測する。[Web対応](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/intro/browsercompatibility)
- **GDevelop：** 3Dモデルを扱う。3D spriteの資料はコミュニティ製の実験的拡張と明記しており、すべてを標準機能と見なさない。[3D model](https://wiki.gdevelop.io/gdevelop5/objects/3d-model/)、[3D sprite](https://wiki.gdevelop.io/gdevelop5/extensions/sprite3d/)
- **Phaser：** 3D連携の例はあるが、紹介されているEnable3DはPhaser 3向け。現在の採用版との互換性まで自動的に保証されない。[Enable3D紹介](https://phaser.io/news/2021/03/enable-3d-phaser-extension)

**評価：実際の3Dモデルと骨アニメーションを中心にする場合は、先の「純2DならPhaser」という推奨から、PlayCanvas・Godotの優先度が上がる。** 表現を決めてからエンジンを絞ることに意味がある。

## 三面図や六面図からルールベースで作れる範囲

提案された「AIで見えない方向を補い、立体化は計算で行う」方式は可能。すでに、単画像への厚み付け、複数方向のシルエットを使うボクセル化を行うツールがある。[Kenney Shape](https://kenney.nl/tools/kenney-shape)、[4面・6面対応のvoxelizer](https://github.com/GazPrash/2d-to-3d-voxelizer)

正投影・同一縮尺・位置合わせ済みの、正面・側面・上面の二値輪郭なら、例えば次の規則で形を作れる。xを幅、yを奥行き、zを高さとする。

```text
残すボクセル(x,y,z)
  = 正面の輪郭(x,z)の内側
    かつ 側面の輪郭(y,z)の内側
    かつ 上面の輪郭(x,y)の内側
```

これは三方向の輪郭を満たす形を作る規則で、唯一の正解を復元する規則ではない。輪郭に現れない凹み、内部、腕の付け根等の隠れた形は決まらない。色の絵を増やしても、深さや関節が一意に決まるわけではない。

完全に整合した正投影の二値輪郭という仮定では、向かい合う方向の輪郭は反転して一致する。六面図は表裏の色や意匠にも使えるが、「形の情報が三面図の倍になる」とは限らない。また、前後左右の四面は、正面・側面・上面の三面とは異なり、上下方向の情報を直接与えない。これは上記の投影規則からの説明である。

### 動くキャラにするための追加仕様

全身の輪郭だけでなく、次の情報を入力する設計にする。

- 部位ID：頭、胴、上腕、前腕、腿、脛、手足等。
- 部位ごとの輪郭または形状テンプレート、奥行き、色。
- 関節の位置、親子関係、基準姿勢。
- 共通の命名規則と、待機・歩行・手振り等の動き。

この仕様から各部位のメッシュを生成し、共通の関節構造に配置する部分は決定論的にできる。部位とパラメータが揃っていれば、変換時にLLMは要らない。ただし、一枚の絵から部位を分離し、隠れた腕や関節位置まで正しく求める部分は別の課題である。

**提案：初期は部位を硬いまま回転させる方式に絞る。** 歩行、頷き、手振り等を共通化し、関節のなめらかな変形や衣服の揺れが必要になった箇所へスキニングを追加する。この段階分けなら、アニメーションを最初から試しつつ仕様を抑えられる。

## ツールと最近の動向

### 静的な立体化を自動化するツール

| ツール | 確認した機能 | アニメーション要件との関係 |
|---|---|---|
| Kenney Shape | 2D形状とピクセルの深さから立体化、glTF・OBJ・VOX等へ出力 | 静物向けの比較候補。骨・部位リグが完成するという資料ではない |
| Voxelorama | Pixeloramaの拡張。レイヤーやピクセル別の深さ、OBJ出力、隣接面の最適化 | レイヤーがそのまま可動部位として保持される保証はない。作者はEarly Accessと記載 |
| sprite2model | 斜めの絵や4方向の絵を解釈しGLB化。CLIとGo API、ローカルWASM版 | 自動化しやすい試験候補。ただしGLB出力だけでは骨や動作を保証しない |
| 2d-to-3d-voxelizer | 単画像・4面・6面等から数式ベースで変換しOBJ出力 | 実験的な静物変換の候補。動くキャラには追加工程が必要 |

出典：[Kenney Shape](https://kenney.nl/tools/kenney-shape)、[Voxelorama](https://github.com/Orama-Interactive/VoxeloramaExtension)、[sprite2model](https://github.com/Coldensjo/sprite2model/blob/main/README.md)、[voxelizer](https://github.com/GazPrash/2d-to-3d-voxelizer)

sprite2modelの`-frame`は、歩行シートの指定行を静的な形として読む指定であり、共通の骨や歩行クリップを作る保証ではない。OBJは静的形状用の中間形式として扱い、部位階層・骨・アニメーションまで渡す納品形式はGLB等を基準にする。[sprite2modelの指定](https://github.com/Coldensjo/sprite2model/blob/main/README.md)、[Godotの形式別制約](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)

### 生成サービスは低ポリと動作までを工程化

Tripoは画像・複数画像からの3D生成、部位分割、リギング、モーション適用をAPIとして分けて提供する。リギング互換性のチェック後に骨を付け、骨付きの結果へ動作を適用する流れになる。[Auto Rig](https://developers.tripo3d.ai/en/docs/animations-rig)、[Animation Retarget](https://developers.tripo3d.ai/en/docs/animations-retarget)

Meshyにも画像からの生成とリギング・アニメーションの機能がある。A/Tポーズ、手足が接していない形、関節周辺の形状が成功に影響する。強くデフォルメされた絵も、必ずそのまま良好な骨付きモデルになるとは限らない。[リギング](https://help.meshy.ai/en/articles/16231707-how-to-create-3d-animation-with-auto-rigging)、[姿勢と形の制約](https://help.meshy.ai/en/articles/16102152-fix-character-pose-face-and-hand-issues-in-meshy)

**部位分割・リグ・動作は別の納品条件。** 分かれた部品が衣服と本体であって、頭・腕・脚ではない場合もある。分割されているだけで、関節の意味、回転軸、スキニング、歩行が完成するとは評価しない。

### 研究も部位とリグを扱う方向へ進んでいる

- **PartCrafter：** 2025年公開の研究実装。画像から複数の部位を持つ3D形状を生成する。部位別生成の根拠はあるが、RPGキャラの歩行リグまで揃うものとは区別する。[公式実装](https://github.com/wgsxm/PartCrafter)
- **AniGen：** 2026年4月の論文は、形状・骨・スキニングを同時に生成する構成を提案。完成した静的形へ後から骨を付ける課題を扱う。[論文](https://arxiv.org/abs/2604.08746)
- **Rigel3D：** 2026年の研究として、形と骨・ウェイトを結び付けた生成を提案。調査時の著者ページにはコード・チェックポイント公開予定の記載があり、即座に使える制作ツールとしては数えない。[著者ページ](https://nchatzis.github.io/Rigel3D/)
- **TRELLIS.2：** 高精細な画像からの3D生成を公開する例。公式READMEの必要環境はLinuxと24GB以上のNVIDIA GPU。重みやコードを取得できることと、手元で低コストに運用できることは分ける。[公式実装](https://github.com/microsoft/TRELLIS.2)

こうした動向から、部位・関節を含む生成は重要な研究対象になっていると評価できる。ただし、ピクセル単位の原案保持、低解像度のデフォルメ体型、必要な動作の成功率と修正量は、今回の素材で別途確認する必要がある。

## 費用は四つに分ける

1. coding agentがコード・設定・修正を行う費用。
2. 画像や複数視点を生成するAPI費用。
3. 3D生成・分割・リギング・モーション等のAPIまたはGPU費用。
4. 人が確認・修正する時間。

変換器を一度作った後も、アセットごとにagentへメッシュの頂点列や巨大なボクセル配列を書かせる構成では、1の費用が増えやすい。固定の変換器にPNGと小さな設定を渡す構成なら、反復処理を通常のプログラムへ任せられる。

### 公開API料金による計算例

2026年11月25日に取得したTripoのH Series基本料金を使用。USD、追加オプションなし、元画像は既にあると仮定する。計算は公表単価からの算術であり、実際の生成・成功率の測定ではない。

| 経路 | 1試行の外部API費用 |
|---|---|
| 複数視点生成だけを使い、形状変換はローカル | $0.10。部位・リグ・動作は別途必要 |
| 元画像→標準テクスチャ付き3D→リグ→歩行1本 | $0.30 + $0.25 + $0.10 = **$0.65** |
| 複数視点生成→上と同じ3D・リグ・歩行 | $0.10 + $0.30 + $0.25 + $0.10 = **$0.75** |

出典：[Tripo API pricing](https://developers.tripo3d.ai/en/pricing)

10体について形状を各3回試し、採用した各1体だけにリグと歩行を付ける仮定なら、直生成の外部費用は`30 × $0.30 + 10 × $0.35 = $12.50`。待機・手振り等の追加動作や修正、agent代は含まない。すべての形状がリギング可能という保証でもない。

Tripoの複数視点APIは前後左右の出力例を持つが、六面図や厳密な正投影・ピクセル整合が保証されたものとしては扱わない。[API仕様](https://developers.tripo3d.ai/en/docs/generation-image-to-multiview)

Tripoの`generate_parts`は、テクスチャ・PBR等と併用できない条件がある。部位生成と、表の「テクスチャ付きモデルから歩行」の経路をそのまま混ぜた料金・成功保証にはしない。[生成時の制約](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard)

MeshyのAPI料金も、形状・テクスチャ・リギング・動作に分かれる。今回の調査ではAPI creditの固定USD換算を確認できていないため、月額プランのcredit数から割り算して単価を作らない。[API credit表](https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost)

画像生成APIを別に使う場合も、coding agentの文章トークンとは別枠。入力画像・文章、出力画像、サイズや品質等で費用が変わる。例えばOpenAIの公式資料も、この内訳を分けて説明している。[画像生成の費用](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency)

### agent費を抑える設計案

- 変換・メッシュ最適化・GLB出力・検査を行うツールを固定し、繰り返し使う。
- 部位名、関節、パレット、基本体型のテンプレートを共通化する。
- キャラごとの入力は元絵、部位マスク、小さな寸法・色・装備の設定に絞る。
- 生成した形状はファイルに保存し、agentへは画像と面数・骨・部位・検査結果の要約を返す。
- 自動再試行の上限を決め、合わない絵にはパラメータ修正や既存テンプレートを使う。
- まず形と部位を確認し、採用候補だけに有料のリグや動作を付ける。

これらは推奨する作業設計であり、既存ツールがすべて自動で提供するという意味ではない。最初にツールを作る費用をF、採用数をNとすると、一体当たりには少なくともF/Nが乗る。数体だけの試作では、既存サービスの小額利用も比較する価値がある。

## 今回の試作で採用する条件

**キャラは静的GLBの表示までで完了とせず、次を確認する。**

- 必要な頭・胴・左右の手足を動かせる部位構造、または利用可能な骨とウェイトがある。
- 関節の位置と基準姿勢、前方向・縮尺・足元原点が揃っている。
- 待機・歩行・手振りをゲーム内で再生し、手足の融合や極端な変形がない。
- 会話時のカメラの寄りでも、顔・手足・輪郭の品質を許容できる。
- 複数キャラで同じ動作と制御を使い回せる。
- スマホWebでの容量・起動・描画負荷と、現在の配布要件を満たす。

比較は、PlayCanvasとGodotのそれぞれで「部位別形状＋共通リグ」と「生成サービス＋自動リグ」を試す2×2を基本とする。すべてを同時に実装せず、同じ一体・同じ三つの動作から順に確かめる。2Dキャラを3D空間に置く案は、低コストの比較基準として残す。

景色は立体にしつつ、移動は地面上の2D判定、カメラは限られた角度と会話時の寄りに絞る案がよい。自由な全方向カメラ、複雑な3D地形移動、衣服の物理等を初期条件へ一度に入れず、欲しいアニメーションと会話の体験から費用を判断する。
