# ブラウザ向け2D RPGゲームエンジン調査

調査基準日：2026年11月25日 JST

転生魔法研究所の3min-rpgを、村・森・研究所が連続する2Dの世界へ育てるためのエンジン比較。Tiledの採用は前提にせず、マップ制作、移動・衝突、カメラ、ブラウザ配布、coding agentとの協働を比較する。将来の3D化も判断材料に含める。

## 結論

3Dキャラクターのアニメーションを必須にする2.5D案は、[表現と制作費を加えた比較](2d-assets-to-animated-3d-survey-2026-11.md)を参照。この場合はPlayCanvas・Godotの優先度が上がる。以下は純2Dを起点とするエンジン比較として扱う。

**ゲームエンジンを選び、その上に作品共通のワールド機能を薄く作る方針を勧める。** 描画・入力・アニメーション・物理・カメラをすべて自作し続けるより、各作品の遊びと世界のつながりへ実装を集中できる。

本プロジェクトに対する推奨は次のとおり。これは下記の公式機能と現在のプロジェクト条件からの評価であり、同一ゲームによる性能測定の順位ではない。

| 重視する条件 | 最初に検証する候補 | 判断理由 |
|---|---|---|
| 現在のTypeScript、ブラウザ中心、単体HTMLを維持 | **Phaser** | 現在のゲームロジックを活かしやすく、描画・カメラ・衝突等を任せられる |
| 本格的な2D制作環境と、同じエンジンでの将来の3D | **Godot** | エディタと2D機能が揃う。Webの配布方式と言語方針の変更を受け入れる必要がある |
| AIがエディタ内のイベントや場面も作る制作体験 | **GDevelop** | 公式の外部agent向けMCPがあり、ビジュアル制作も比較対象にできる |
| 2D制作に集中し、専用言語と公式CLIで自動化する | **GameMaker** | RoomとGMLの制作方式に加え、公式ResourceToolのMCP経路も比較できる |
| Webとネイティブ配布を両方育てる、Luaを採用できる | **Defold** | CLIと公式のagent向け自動化経路がある。TSからの移植負担を比較する |
| ブラウザ主体の3D・2.5Dを近い将来に試す | **PlayCanvas** | JS/TSと3D制作、公式skills・Editor MCPの組合せを評価できる |

まずPhaserとGodotで同じ小さな探索場面を作り比べるのがよい。エディタをagentに操作させる制作を重視するならGDevelopを加える。最初から全候補への移植を行う必要はない。

## 選定条件

現在のプロジェクトには、TypeScriptのES modules、マウス・タッチ優先、外部通信不要の単体HTML配布という方針がある。これを維持する案と、エンジン採用に伴い変更する案を分ける。

ここでのブラウザ対応は、完成したゲームをブラウザで実行することを基準とする。制作エディタ自体もブラウザで使えるかは別の項目として扱う。

評価する体験は次のものとする。

- 村から森・研究所へ、画面を暗転させずに歩いて移動できる。
- キャラクターの足元で衝突し、木や建物との前後関係が正しい。
- タップ移動とキーボード移動を共通化できる。
- NPCとの会話ではカメラが寄り、終了時に探索の構図へ戻る。
- 二択、コマンド戦闘、防衛アクションを、同じ世界の別の出来事として載せられる。
- スマホで文字・操作・読み込み時間が適切で、保存後に再開できる。

「メジャー」は市場シェア順という意味ではなく、継続的に使われる主要な汎用エンジン・RPG制作ツールを中心に扱う。コード中心の追加候補と描画ライブラリも区別して含める。

## 主要候補の比較

| エンジン | 制作方法と言語 | 2D RPG基盤としての位置づけ | 今回の主な検討点 |
|---|---|---|---|
| Phaser | JS/TS、コード中心。Editorも別途利用可能 | タイルマップ、カメラ、シーン、衝突等を組み合わせる | RPGの会話・クエスト・世界接続はプロジェクト側で作る |
| Godot | エディタ＋GDScript。WebではC#に制約 | TileMapLayer、2D物理、アニメーション、UIを備える | Web出力とスマホ性能、言語変更、シーンの管理方法 |
| Defold | エディタ＋Lua | タイルマップ、衝突、カメラ、生成機能等を組み合わせる | Luaへの移植、テキスト資源とCLIを使う制作方法 |
| GDevelop | エディタのイベント＋JS拡張 | 移動等のbehaviorとイベントを組み合わせる | 公式agent連携を含めてエディタ中心の制作を受け入れるか |
| Construct 3 | ブラウザエディタ、イベント＋JS/TS | Tilemap、移動behavior、レイヤー等を利用 | プロジェクトを外部agentが直接書き換える場合の制約 |
| GameMaker | エディタ＋GML | Room、tile layers、camera、Object/Event等を組み合わせる | 公式CLI・ResourceToolと、既存TSからの移植 |
| RPG Maker MZ | RPG専用エディタ＋JSプラグイン | RPG制作に特化した土台を利用 | シームレスな世界と独自ルールをどこまで拡張するか |
| PlayCanvas | ブラウザエディタ、またはローカルJS/TS | 3Dエンジンのsprites等で2Dも制作 | 2Dワールド機能の実装量と、将来の3Dによる利点 |
| Unity | デスクトップエディタ＋C# | 2D/3Dを扱う汎用制作環境 | Webビルドの実サイズ・起動・メモリを比較する |

この表の推奨度は、以下の候補別資料とプロジェクトへの適合評価に基づく。

### Phaser

Tiled JSON・CSV・配列からマップを構築でき、TilemapLayerにはカメラの可視範囲に応じた描画と物理エンジンとの連携がある。Tiledを必須にする必要はなく、マップ制作方法は後から選べる。[Tilemap](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-tilemap)、[TilemapLayer](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-tilemaplayer)

**今回の評価：現状からの第一候補。** 既存のTSで書いた勝敗や状態遷移を残し、描画と入力を移す構成を取りやすい。会話、調査、セーブ、地域接続などは別の共通モジュールとして設計する。Phaserを入れれば完成したRPGになるわけではない。

2026年4月10日のPhaser 4リリースでは、公式リポジトリ内のagent skillsと移行用skillも案内されている。古いPhaser 3の例をそのまま混ぜず、採用する版を固定して型定義と対応資料を参照する運用がよい。[Phaser 4リリース](https://github.com/phaserjs/phaser/releases/tag/v4.0.0)、[インストールと型定義](https://docs.phaser.io/phaser/getting-started/installation)

同年5月28日の公式解説では、地形レイヤーを専用シェーダーで描くTilemapGPULayerも紹介している。大きな地図を描く選択肢が増えている一方、描画の高速化と、NPCの処理・保存・区画管理の負担は分けて考える。[GPU描画の解説](https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance)

### Godot

TileMapLayerで地形を制作し、タイルに衝突・遮蔽・ナビゲーション形状を設定できる。2Dの移動も標準的なNodeを組み合わせて作れる。[タイルマップ制作](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html)、[2D移動](https://docs.godotengine.org/en/stable/tutorials/2d/2d_movement.html)

シーン・資源をテキスト形式で扱い、CLIのheadless実行とエクスポートを使えるため、agentがファイルを編集して検査する構成を取れる。会話やクエストの仕組みはゲーム側の責任になる。[CLI](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)、[シーン形式](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)

**今回の評価：言語と配布方式を変更できる場合の有力候補。** Web出力はWASM等を含む複数ファイル。Godot 4のC#プロジェクトはWebへ出力できず、Webで使えるレンダラーやスレッドにも制約がある。スマホWebはネイティブ出力と同じ性能を期待せず検証する。[Web出力の制約](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

同じエンジン内で3Dも制作できる利点がある。ただし、2Dから3Dへ移るときのモデル・アニメーション・カメラ等の制作は別途必要である。

### Defold

Luaを使い、タイルマップ、衝突、カメラなどを組み合わせる。Bobによるエディタ外のビルド・バンドルに対応し、自動化の経路を持つ。[Tilemap](https://defold.com/manuals/tilemap/)、[Bob](https://defold.com/manuals/bob/)

公式のAI agent向け資料があり、エディタのローカルHTTP APIとOpenAPI、実行中ゲームの操作、公式Automation Bridgeを案内している。公式MCPを必須とする設計ではなく、基礎APIを直接利用する方向である。Asset PortalにあるコミュニティMCPは、Foundationによる公式保守とは区別する。[AI agents](https://defold.com/manuals/ai-agents/)

**今回の評価：TSの維持よりも、Webとネイティブの共通制作環境を重視する場合の比較候補。** Web出力は標準では複数ファイルのバンドルで、HTTP配信を前提とする。現在のTSロジックの再利用方法・移植量を確認する必要がある。[HTML5出力](https://defold.com/manuals/html5/)

### GDevelop

イベントとbehaviorを中心に制作するエンジン。公式MCPは、外部agentによるシーン・オブジェクト・behavior・変数・イベントの操作や、gameplay tests、保存に対応する。動作には同じPCでGDevelop Desktopを開く必要がある。[公式MCP](https://wiki.gdevelop.io/gdevelop5/interface/ai/mcp/)

内蔵のGDevelop AIも、質問への回答に加えてプロジェクトの仕組みを作る機能を持つ。内蔵AIと、自分のcoding agentから公式MCPで操作する経路は分けて評価する。[内蔵AI](https://wiki.gdevelop.io/gdevelop5/interface/ai/)

**今回の評価：ビジュアルエディタをagentに操作させる案として有力。** 「ノーコードだからagentに不向き」とは判断できない。一方、通常のTSリポジトリを編集する制作方法とは変わる。MCPの検索等にはオンラインサービスとログインを使う部分があり、制作時の通信条件と完成ゲームの通信条件を分けて確認する。[MCPの動作条件](https://wiki.gdevelop.io/gdevelop5/interface/ai/mcp/)

### Construct 3

ブラウザで使えるエディタで、Tilemap、Tile movement、イベントシート等を利用できる。JS/TSのスクリプトも組み込める。[Tilemap](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/tilemap)、[Script files](https://www.construct.net/en/make-games/manuals/construct-3/scripting/using-scripting/script-files)

**今回の評価：人がエディタで制作し、agentがスクリプトを支援する案に合う。** プロジェクトファイルはJSONでも、その形式は外部から安全に編集できる公開契約ではない。公式も直接変更よりエディタ利用を勧めている。テキストであることだけを根拠にagent適性を高く評価しない。[プロジェクト形式](https://www.construct.net/en/tutorials/constructs-project-format-3275)

標準のWeb出力は複数ファイルをサーバーで配信する方式。初回読み込み後のオフライン対応は、最初から単体HTMLを直接開くこととは異なる。[Web公開](https://www.construct.net/en/tutorials/publishing-web-10)

### GameMaker

2Dを中心とするエンジンで、Room・tile layers・Object/Event・GMLによって場面とゲームルールを組み立てる。HTML5出力を持ち、IgorによるCLIビルドも案内されている。[製品概要](https://gamemaker.io/en/about)、[Room](https://manual.gamemaker.io/lts/en/The_Asset_Editors/Room_Properties/Room_Properties.htm)、[CLIビルド](https://manual.gamemaker.io/lts/en/Settings/Building_via_Command_Line.htm)

プロジェクトは`.yyp`、資源はJSONに近い`.yy`、ゲームコードはGMLで管理する。公式の`gm-cli`は編集・コンパイル・実行等に対応し、ResourceToolをMCP経由で扱う機能やagent設定の生成も案内する。ResourceToolとIDEのファイル形式の互換性があるため、ツールの版を合わせる必要がある。[形式](https://manual.gamemaker.io/lts/en/Additional_Information/Project_Format.htm)、[公式gm-cli](https://github.com/YoYoGames/gm-cli)

**今回の評価：2D制作とagentによるプロジェクト操作を両立する比較候補。** TSからGMLへの移植と、Web出力のフォルダ構成は現在の方針と異なる。Igor利用のライセンス条件、ビルド前のIDEへのログイン条件も確認する。[ライセンス区分](https://gamemaker.io/en/get)、[CLIの条件](https://manual.gamemaker.io/lts/en/Settings/Building_via_Command_Line.htm)

### RPG Maker MZ

RPG制作に特化したツールで、ゲーム部分はJavaScriptで実装され、プラグインで拡張できる。Web公開も可能である。[製品の位置づけ](https://rpgmakerofficial.com/product/MZ_help-en/01_01.html)、[JavaScript拡張](https://rpgmakerofficial.com/product/mz/plugin/javascript/first.html)、[Web出力](https://rpgmakerofficial.com/product/MZ_help-en/01_11_03.html)

**今回の評価：標準的なRPGを素早く組む案として比較価値がある。** 今回のような連続世界、独自の防衛アクション、異なるルールを載せる基盤では、標準の制作方式に合わせる部分と追加プラグインを作る部分を見積もる必要がある。agentの担当をJSプラグイン編集に絞る案も考えられる。

### PlayCanvas

3Dを中心とするWebエンジンだが、sprites・アニメーション等の2D機能も備える。エディタなしでローカルのJS/TSプロジェクトとして使う方法も公式に案内されている。[2D機能](https://developer.playcanvas.com/user-manual/2D/)、[Standalone Engine](https://developer.playcanvas.com/user-manual/engine/standalone/)

公式skills、agent向けの資料、Editor MCPがある。MCPはシーンやアセットの変更に加え、viewport・実行中アプリの画像、ログ、状態、入力を通して結果を確認する用途まで案内されている。[Developing with AI](https://developer.playcanvas.com/user-manual/engine/developing-with-ai/)、[Editor MCP](https://developer.playcanvas.com/user-manual/editor/mcp-server/)

**今回の評価：近い将来の3D・2.5Dまで含めると注目候補。** 2D RPGのワールド制作機能をどこまで補うかを、Phaser・Godotと比較する。Engineをローカル利用する案と、Editorを使う案は、保管場所や制作手順も含めて分けて扱う。

### Unity

Web出力を持つ2D/3Dの汎用エンジン。Unity 6の現行資料は、一部のスマホブラウザも対応対象としているため、古い資料の「モバイルWeb非対応」で候補から外すのは不適切である。[Unity 6 Web対応ブラウザ](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/intro/browsercompatibility)

公式のagent向けCLI・skills・MCPが整備されている。現行資料では、AI Assistantパッケージ内の旧MCPサーバーを非推奨とし、Unity CLIに移行する方針である。CLIはローカルEditorを操作し、headless buildやtestにも使える。[Unity CLIへの移行](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)

**今回の評価：3Dやネイティブ展開を強く重視する場合の比較候補。** 小規模なスマホWeb RPGに対しては、配信量・起動時間・メモリ・ビルド時間が許容範囲かを実測して判断する。AI機能の存在だけで採用せず、既存TSからC#への移植も比較する。

## コード中心の追加候補

### melonJS

Tiledとの連携、複数レイヤー、アニメーションタイル、衝突形状、カメラ等を備える。ES modulesとTS型定義を持ち、公式リポジトリでもagent向けskillsや資料を案内している。[公式機能](https://melonjs.org/docs/)、[公式リポジトリ](https://github.com/melonjs/melonJS)

**評価：Phaserと同じTS・Web系の比較候補。** マップ主体の実装のしやすさを実例で比較したい。公式資料は3D機能も案内しているが、3D制作全体の負担がGodot等と同じになるという意味ではない。

### Excalibur

TypeScriptの2Dエンジン。TiledとLDtk向けの公式プラグインがあり、タイル・衝突・オブジェクトをゲームへ変換する機能を持つ。ただしTiled World等、未対応の機能もある。[エンジン](https://excaliburjs.com/docs/engine/)、[Tiled plugin](https://excaliburjs.com/docs/tiled-plugin/)、[LDtk plugin](https://excaliburjs.com/docs/ldtk-plugin/)

公式create-excaliburはMCPも提供する。資料検索・雛形生成等の支援と、実行中ゲームの状態を操作・観測する機能は分けて評価する。[公式作成ツール](https://github.com/excaliburjs/create-excalibur)

**評価：TSを中心に、小さな2D基盤を理解しながら育てる比較候補。** 主要候補と同じ条件で、必要な実装量とプラグインの制約を比較する。

### PixiJSの位置づけ

PixiJSは公式FAQでゲームエンジンではないと説明されている。描画を任せるには有用だが、移動・衝突・ワールド・会話・保存などは追加することになる。今回の「ゲーム基盤を共通化したい」という目的では、完成したゲームエンジンと同列には評価しない。[FAQ](https://pixijs.com/faq)

agent向け公式skillsも存在し、2026年11月11日のv8.23.0ではパッケージへの同梱も案内されている。agent支援があることと、ゲームエンジンの機能が揃うことは別の評価項目である。[公式skills](https://github.com/pixijs/pixijs-skills)、[v8.23.0リリース](https://github.com/pixijs/pixijs/releases/tag/v8.23.0)

## coding agentとの相性をどう判断するか

「AI対応」の表示より、agentが変更と検証を往復できるかを重視する。

| 確認する能力 | 選定で見る点 |
|---|---|
| 正しいAPIを参照する | 採用版の型定義、公式資料、skillsが読める |
| プロジェクトを変更する | コードだけでなくシーン・マップ・資源も編集できる |
| 差分をレビューする | テキスト差分やエディタ上の変更を追える |
| 機械的に検査する | CLIビルド、型検査、ロジックテストが実行できる |
| 実行結果を観測する | ログ、画像、NPCの位置や保存状態を確認できる |
| 操作して確かめる | タップ、移動、会話、再開を実際の入力で試せる |

コード中心のエンジンは既存のGit・npm・TSの作業手順へ載せやすい。一方、エディタ中心でも公式APIやMCPで状態を読み書きできれば、有力な選択肢になる。MCPの数やツール数を、そのまま制作速度の順位にはしない。

### 2026年の注目動向

1. **Phaserは、skills・ローカルEditor連携・クラウド生成サービスを分けて展開。** 2026年7月8日公開のGame Agent MCPは、アカウントに紐づくクラウド作業環境で生成する有料サービス。ローカルの既存リポジトリを編集するEditor MCPとは別物である。Editor v5 MCPは開発中と記載されているため、機能範囲を固定して試す。[Game Agent MCP](https://phaser.io/news/2026/07/phaser-game-agent-mcp-setup)、[Editor MCP](https://phaser.io/oss/docs/phaser-editor/ai/mcp-server)
2. **PlayCanvasは、制作と実行確認の双方をagent向けに整備。** 2026年10月21日のEditor 2.35では、MCPからプロジェクトを一覧・作成・変更・開く機能も案内している。[公式更新](https://blog.playcanvas.com/new-in-playcanvas-editor-projects-home-and-mcp/)
3. **GDevelopは、外部coding agentからイベントやsceneも操作する公式経路を提供。** ビジュアル制作ツールを、コード編集しかできないagentから使いにくいと一括評価するのは古くなっている。[公式MCP](https://wiki.gdevelop.io/gdevelop5/interface/ai/mcp/)
4. **Defoldは、MCPそのものより直接利用できるAPIを重視。** HTTP/OpenAPIや実行中ゲームの操作経路を公式に整える方針で、MCPの有無だけではagent適性を比較できない。[公式agent資料](https://defold.com/manuals/ai-agents/)
5. **UnityもCLI・skillsと、CLI経由のMCPへ進んでいる。** 2026年5月の旧MCP紹介だけを参照すると現行方式と食い違う。選定時には最新のCLI資料を基準にする。[現行の移行資料](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)
6. **GameMakerも、公式CLIから資源を編集するMCP経路を提供。** エディタで行っていた資源の作成・変更をagentが扱えるようにする動きとして注目できる。[公式gm-cli](https://github.com/YoYoGames/gm-cli)

Godotには[コミュニティ製のMCP](https://godotengine.org/asset-library/asset/4767)等もあるが、公式配布元のサイトに掲載されていることと、エンジン開発元の公式保守は区別する。また、Godotの2026年6月30日のAIに関する投稿方針は、エンジン本体への貢献のルールである。これをGodot製ゲームのAI利用禁止と読むのは誤りである。[貢献方針](https://godotengine.org/article/contribution-policy-2026/)、[Godotライセンス](https://godotengine.org/license/)

## 単体HTMLとWeb公開は分けて比較する

現在の要件は、外部通信不要でHTMLを一つ取り出して動くこと。この要件は、Webエクスポート可能、静的サイトへ設置可能、初回ダウンロード後にオフライン可能、という条件より強い。

| 出力方式 | 候補と判断 |
|---|---|
| JS/TSと画像等をビルド時に内包する | Phaser等は検証候補。Phaserのローダーにはdata URI対応があるが、外部マップ・画像参照の書換えはプロジェクト側の責任 |
| HTMLとWASM・資源等をまとめて配信する | Godot・Defold等の通常のWeb出力。単体HTMLを標準で出すこととは異なる |
| エディタのWeb公開機能を利用する | Construct・RPG Maker等でも、標準の出力ファイル構成とHTTP配信条件を確認する |

参照：[Phaser loader](https://docs.phaser.io/phaser/concepts/loader)、[Godot Web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)、[Defold HTML5](https://defold.com/manuals/html5/)、[Construct Web公開](https://www.construct.net/en/tutorials/publishing-web-10)、[RPG Maker出力](https://rpgmakerofficial.com/product/MZ_help-en/01_11_03.html)

**評価：単体HTMLを維持するなら、それを最初の合否条件にする。** エンジン採用後に配布方法を変更する案では、HTMLとローカル資源一式の配布も比較できる。ただし、後者への変更は現在のプロジェクト方針の変更になる。

## オープンワールドのために追加する共通機能

エンジンのタイルマップ対応だけでは、求める世界は完成しない。共通基盤は次の責任を受け持つ。

- **地域の接続：** 村・森・研究所を共通座標へ配置し、境界を越えても移動とカメラが連続する。
- **区画管理：** 大きくなった世界を部分的に有効化し、遠くのNPCや衝突処理を止める。
- **移動の統一：** 足元の衝突とタップ経路探索を、操作方式をまたいで揃える。
- **調査と会話：** NPC・看板・宝箱の共通インターフェースと、会話時のカメラ制御を持つ。
- **世界の保存：** NPCや宝箱、クエスト、主人公の位置を安定したIDで保存する。
- **作品ルールとの接続：** 戦闘や二択等の開始・終了を、マップの状態へ反映する。

画面外のタイルを描かない処理、画像を遅れて読み込む処理、TiledのInfinite Mapを読む処理は、それぞれ区画管理の一部に使えるが同じ機能ではない。Infinite Map対応という表記だけで、地域の接続・NPCの状態保存・大規模な読み込み管理まで自動化できるとは判断しない。

最初は小さな世界を一括で持つ実装でよい。共通の座標と保存IDを決め、実際の配信量や負荷に応じて区画管理を加える。独自の巨大エンジンを先に完成させる必要はない。

## ライセンスとサービス費用

| 候補 | 確認した位置づけ |
|---|---|
| Phaser | MIT。Editorやクラウド生成サービスの条件は別に扱う。[Engine license](https://github.com/phaserjs/phaser/blob/master/LICENSE.md) |
| Godot | MIT。[公式ライセンス](https://godotengine.org/license/) |
| Defold | 独自のDefold License。ゲームの商用化は許可する一方、エンジン・エディタ自体の商用化には制限がある。Apacheそのものとは記載しない。[公式説明](https://defold.com/license/) |
| GDevelop | コア・IDE・HTML5エンジン等はMIT。オンラインサービスやAI利用のプラン条件は別。[公式リポジトリ](https://github.com/4ian/GDevelop#license) |
| Construct 3 | 商用製品。無料版と有料プランの機能条件を比較する。[公式プロジェクト資料](https://www.construct.net/en/make-games/manuals/construct-3/project-primitives/projects) |
| GameMaker | 非商用向け無料枠にWeb出力を含む。商用はProfessional等、Igor/CIもプラン条件を確認する。エンジンと、公開されているCLIのライセンスを混同しない。[公式区分](https://gamemaker.io/en/get) |
| RPG Maker MZ | 商用制作ツール。製品・追加素材・プラグインの条件を分ける。[製品案内](https://rpgmakerofficial.com/product/mz/index.html) |
| PlayCanvas | Engine単独利用とEditorのサービス条件を分ける。Editorには公開プロジェクト向け無料枠と非公開プロジェクト向け有料プランがある。[Engine単独利用](https://developer.playcanvas.com/user-manual/engine/standalone/)、[Editorプラン](https://playcanvas.com/plans) |
| Unity | 商用製品。エンジンのプランとAI支援サービスの費用は別。[公式プラン](https://unity.com/products)、[AI tools](https://unity.com/features/ai) |
| melonJS / Excalibur | それぞれMIT / BSD-2-Clause。[melonJS](https://github.com/melonjs/melonJS)、[Excalibur](https://github.com/excaliburjs/Excalibur) |

比較時には、制作時のエディタ・AI料金と、完成ゲームが遊ばれるたびに必要な費用を分ける。開発にAIを使うことは、ゲーム実行時にLLMや外部APIを必要とすることを意味しない。

## 採用前の比較試作

最初の比較はPhaserとGodotを基本とし、制作方式を比較したい場合はGDevelopを追加する。素材と世界の規模を揃え、各候補で次の一連の体験を作る。

1. 村から森まで、画面切替なしで歩く。
2. 家や木の幹にぶつかり、木の葉の後ろでは主人公が隠れる。
3. タップしたNPCの隣へ歩き、会話とカメラの寄りが始まる。
4. 宝箱の状態と主人公の位置を保存し、再開する。
5. 既存の3min-rpgから一つの小さな出来事を接続する。
6. 対象スマホで開き、配布要件と操作を確認する。

| 記録するもの | 比較する意味 |
|---|---|
| 配布量、初回起動、メモリ、フレーム時間 | スマホWebでの実用性 |
| 地域境界・会話開始・復帰時の停止 | 連続した世界としての感触 |
| agentが編集したファイル・エディタ操作と差分 | 人が変更を理解して引き継げるか |
| ビルド・テスト・実操作確認までの工程 | agentが作業を完結できるか |
| 既存TSロジックの再利用量と書換え | 3作品を載せ直す費用 |
| 単体HTML、通信、配信設定 | 現在の配布方針に合うか |

この調査では各候補の移植や同条件の性能測定は行っていない。したがって、採用前に比較すべきものは具体化できるが、特定エンジンの速度・容量・制作時間の数値優位はまだ判断しない。

当面は現在のゲームルールを独立したTSモジュールとして保ち、採用エンジンに依存する描画・入力と分離する。エンジン選定を先に行い、その実例から必要な共通ワールド機能を切り出す順番が、このプロジェクトには合う。
