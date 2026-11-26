# 転生魔法研究所 / tensei-lab

世界樹の木陰で、次の人生を研究しています。

短い異世界ゲームを単品で試しながら、記憶の葉・スキル・キャラクター・アセットを育てるプロジェクトです。
サークル名は「転生魔法研究所」。ディレクトリ名は指定に合わせ `isekai-lab` を想定しています。

## HD-2D実験

3D背景と大型キャラクターの制作・描画方式を比較する実験は、独立した [`hd-2d/`](hd-2d/README.md) で進めます。商用利用を含め無料のツールに限定し、Babylon.jsの共通基盤でファンタジーの森・街・洞窟を比較し、固定条件の計測JSONとシーン画像を保存できます。背景と人物の実験画面を分け、人物側には独立した歩行検査コースを用意しています。キャラクター表示方式の比較は次の段階です。

`npm run hd2d:build`で単体HTMLをビルドし、`npm run cf:with-env -- npm run cf:deploy:private`で既存ゲームと一緒に更新します。配信先は本人専用環境の[/hd-2d/](https://tensei-private-games.tensei-lab.workers.dev/hd-2d/)です。操作・型検査・テストの手順は[HD-2DのREADME](hd-2d/README.md)を参照してください。

担当範囲・構成・受入条件は[開発計画書](docs/hd2d-experiment-plan-2026-11.md)を参照してください。

## 最初の試作

| 出力 | ゲーム | 操作 | 一回の区切り |
|---|---|---|---|
| `3min-rpg/dist/index.html` | 試作室・葉メーカー | マウス / タッチ | 3作品の入口 |
| `3min-rpg/dist/game1.html` | 三分間の死に戻り「鐘の村」 | 歩く主人公を見ながら選ぶ二択 | 8場面以内、目安3分。時間制限なし |
| `3min-rpg/dist/game2.html` | ハズレスキル研究所 | コマンド戦闘 | 3連戦、目安3分。時間制限なし |
| `3min-rpg/dist/game3.html` | こもれび防衛線 | 移動先クリック / タッチ、攻撃自動 | 操作中の180秒、成長・休憩中は停止 |
| `3min-rpg/dist/fullscreen-mock.html` | 全画面RPGのフィールドモック | タップ移動・会話・場所切替、下にコメント欄 | 画面構成の確認用 |

## 実行

Node.js 24以上。ビルドとゲームロジックのテストは外部依存のインストール不要です。

```sh
npm run build
npm test
npm run dev
```

`http://127.0.0.1:4173` を開きます。起動後の変更には再ビルドが必要です（自動リロードなし）。
`PORT=4174 npm run dev` のように、別のポートを指定できます。`PORT` は0から65535までの整数です。`PORT=0 npm run dev` ではOSが選んだポートを起動時に表示します。
「ポートがすでに使われています」と表示された場合は、別の `PORT` を指定するか、そのポートを使っている開発サーバーを停止してください。待受権限の案内が出た場合は、実行環境の待受権限を確認し、ローカルのターミナルなど待受可能な環境で実行してください。

生成済みのHTMLを再ビルドせず、同じLANのスマホへ配信する場合は次を実行します。こちらの配信コマンドはNode.js 20でも動作します。スマホから `http://<PCのLAN内IP>:4174/game2.html` を開いてください。

```sh
HOST=0.0.0.0 PORT=4174 npm run preview
```

`npm run dev` はビルドも行うため、Node.js 24以上が必要です。
TypeScriptの型検査を行う場合は、開発依存をインストールしてから実行します。

```sh
npm install
npm run typecheck
```

ビルドした各HTMLはCSS・JavaScript・ドット絵データをすべて内包します。
ゲーム自体にはサーバー、APIキー、CDN、実行時LLM、ネット接続は不要です。
単品HTMLを取り出してもそのゲームと葉メーカーは動作します。別作品へのリンクだけは、同じフォルダに他のHTMLが必要です。

PCではHTMLを直接開けます。スマホはOSによってローカルHTMLをプレビュー表示することがあるため、同じHTMLを静的ホスティングしてブラウザから開く方法を推奨します。
開発サーバーをLANから開く場合は `HOST=0.0.0.0 npm run dev` とし、同じLANのスマホからPCのIPアドレスを使います。

## 全画面RPGのモック

`npm run build` 後に `3min-rpg/dist/fullscreen-mock.html` をChromeへドラッグして開けます。プレビューサーバーでは `http://127.0.0.1:4173/fullscreen-mock.html` です。

昔の2D RPGのように、地面を見下ろしながら建物やキャラクターの正面も見えるフィールドを、最初の1画面いっぱいに表示します。道・川・橋・家・木の間をタップで歩き、村人や看板を調べられます。キーボードでは矢印キー / WASDで移動、Enterで調べます。メニューから「鐘の村」「魔法研究所」「こもれび防衛線」を切り替えて画面構成を確認できます。

ゲーム内の小さなHUDと操作だけをマップに重ね、感想・コメントはゲームの下へスクロールして表示します。このHTMLはフィールドの移動・会話を試す画面モックです。コメントは表示例と端末内の試し書きで、オンライン投稿には接続していません。ソースと素材の出自は [mock/README.md](3min-rpg/mock/README.md) を参照してください。

Chromeでスマホのレイアウトを確認する手順（Mac）:

1. モックを開き、`⌘ + Option + I` で開発者ツールを開く。
2. 開発者ツールを開いた状態で `⌘ + Shift + M` を押す。左上のスマホ・タブレットのアイコンからも切り替えられる。
3. 上部の「Dimensions / サイズ」で「Responsive」を選び、幅と高さを入力する。まず `390 × 844`、小さい画面は `320 × 568`、広い画面は `430 × 932` を試す。
4. 回転ボタンで横向きも確認する。表示が収まらない場合はツールバーのズームを「Fit to window」にする。
5. 主人公が見えるか、タップした場所へ歩けるか、コメントへ移動してゲームに戻れるか、文字やボタンが重ならないかを確認する。

Windows / Linuxでは開発者ツールが `Ctrl + Shift + I`、スマホ表示切替が `Ctrl + Shift + M` です。操作の詳細は [Chrome公式のDevice Mode](https://developer.chrome.com/docs/devtools/device-mode) と [ショートカット一覧](https://developer.chrome.com/docs/devtools/shortcuts) を参照してください。

Device Modeは画面サイズやタッチ操作の近似です。スマホのアドレスバーの伸縮、画面の切り欠き、ソフトキーボードの挙動は実機でも確認してください。

## 構成

```text
3min-rpg/
  common/
    src/       # 共通UI、記憶の葉、描画、CSS、試作一覧
    assets/    # 全作品で使う16×16ドット絵、パレット、ライセンス
    vfx/       # 出典付きの魔法アニメーション、tsParticles用シート描画
  game1/
    src/       # 二択死に戻りの状態遷移とUI
    assets/    # 固有アセット用
  game2/
    src/       # コマンド戦闘のルールとUI
    assets/
  game3/
    src/       # 移動・敵・弾・成長のシミュレーションとUI
    assets/
  mock/
    src/       # 全画面RPGの画面構成、独立CSS、手続き描画
  effects/
    src/       # 魔法カタログのプレビュー、検索、個別JSON書き出し
  scripts/     # 単体HTMLビルド、ローカルプレビュー
  tests/       # 状態遷移、勝敗、記憶の移植の検証
  dist/        # 再生成できる配布HTML（Git追跡対象外）
```

ソースはTypeScriptのES modulesです。今回のビルドは、Nodeの型除去と小さなパッカーを使い、単体HTMLにまとめています。
パッカーは相対パスの名前付きimportと名前付きの宣言exportに限定しています。追加ライブラリや大きなアセットを導入するときは、esbuild等に置き換える前提です。
現段階で全作品の戦闘やゲームループを統一する基底クラスは作っていません。共有は葉・描画・見た目・入出力に限定しています。

## 戦闘エフェクトの編集

「ハズレスキル研究所」の粒子演出には、無料・MITライセンスの [tsParticles](https://github.com/tsparticles/tsparticles) 4.6.0を使っています。演出の色・数・速さ・大きさ・発生位置は `3min-rpg/game2/src/vfx-presets.ts` で調整し、`npm run build` で単体HTMLに反映します。エンジン本体とライセンスもHTMLに内包するため、遊ぶときの外部通信は不要です。

制作支援用の[公式MCPサーバー](https://github.com/tsparticles/tsparticles/tree/main/integrations/mcp-server)も固定バージョンで導入しています。開発依存を `npm ci --ignore-scripts` で用意し、リポジトリを作業ディレクトリとして `npm run --silent effects:mcp` を実行すると、ローカルのstdioサーバーが起動します。AIから設定診断・必要なプラグインの確認・コード生成を利用できます。MCPは制作時だけの道具で、配布ゲームには同梱しません。

詳細と出自は `3min-rpg/game2/assets/README.md` と `3min-rpg/common/vendor/README.md` を参照してください。

魔法の画像アニメーションは `3min-rpg/common/vfx/` に収録しています。`npm run build` 後に `3min-rpg/dist/effect-catalog.html` をブラウザで開くと、種類を選んで再生し、画像込みのエフェクトJSONを書き出せます。`npm run preview` を使う場合は `/effect-catalog.html` です。PC・スマホ向けの単体HTMLで、画像も内包し、再生に外部通信は使いません。

素材は para 氏の [Animated particle effects #1](https://opengameart.org/content/animated-particle-effects-1) と [#2](https://opengameart.org/content/animated-particle-effects-2)、Mikodrak 氏の [2D Spell Effects](https://opengameart.org/content/2d-spell-effects)（いずれもCC0）から、炎・魔法陣・転移・泡・火球・雷球などを取り込んでいます。元のコマ順・色・透明背景・再生速度を保ち、tsParticles用のシート描画拡張と組み合わせて再生します。既存の戦闘への割り当ては、カタログから選んで行えます。利用方法・素材の追加手順・出典は [共通VFXのREADME](3min-rpg/common/vfx/README.md) を参照してください。

## 記憶の葉

- クリアと失敗のどちらでも、その回の記録を一枚残します。
- 名前と短文を編集でき、自分で新しい葉も作れます。
- PNG画像として保存できます。
- JSONの書き出し / 読み込みで、端末や別HTMLへ葉と発見を持ち運べます。読み込みは既存データと統合し、同じIDは重複しません。
- この試作の葉は記念品です。ゲームをまたぐ能力継承や、課金・交換市場・ランキングは未実装です。
- 鐘の村の発見は葉の文章と別の状態として保存し、死に戻りで持ち越します。葉を編集してもゲームのルールは変更されません。
- HTTPSで同じサイトから開くと、同じブラウザ内で3作品の保存領域を共有します。
- `file://` で直接開いたときのlocalStorageはブラウザによって扱いが異なります。自動保存できない場合は画面に案内を出します。バックアップには書き出しを使ってください。

## 参考にした操作・設計の方向

既存作のコード・文章・アセットは流用していません。

- [Minit](https://devolverdigital.itch.io/minit): 短い命と再試行から得る発見。
- [勇者30](https://store.steampowered.com/app/214830/): RPG体験を短い区切りへ圧縮する考え方。
- [Card Crawl](https://play.google.com/store/apps/details?id=com.tinytouchtales.cardcrawl): カード中心の短いプレイ。
- [Card Quest](https://store.steampowered.com/app/493080/): スキルを選んで攻略するカード戦闘。
- [Vampire Survivors](https://play.google.com/store/apps/details?id=com.poncle.vampiresurvivors): 少ない操作と成長選択を中心にする方向。

## 次に育てるもの

まず実際に遊び、3つの操作のどれが気持ちよいか、葉を残したくなるかを比較します。
以後、葉の効果、追加シナリオ、アセットの差し替え、音、ゲームパッド、Steam用デスクトップ包装を検討します。
公開者名はサークル名にそろえ、実名や連絡先はこの試作へ埋め込んでいません。

## この環境での検証

- 単体HTMLを4本ビルドし、JavaScriptの構文と外部依存がないことを検査しました。
- 状態遷移・勝敗・保存データ・共通アセット・配布HTML・開発サーバー起動の自動テストを実行しました。
- アクションは、移動と成長を含む180秒のシミュレーションでクリア可能なことも確認しました。
- プレビューサーバーは `127.0.0.1:4173` で起動し、`/` と `game1.html`、`game2.html`、`game3.html` がHTTP 200で応答することを確認しました。ブラウザ画面での実操作・スマホ幅の目視確認は、ブラウザ機能を利用できないため未実施です。
- `tsc` による型検査、Nodeの型除去・構文解析、自動テストを確認しました。
