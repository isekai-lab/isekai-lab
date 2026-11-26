# 背景の改善ループ

計画、実装、画像評価を分けます。採点役は新しい `codex exec` プロセスで起動し、参考画像・候補画像・固定した採点基準だけを渡します。親の会話やソース、変更の意図、期待する点数は渡しません。キャラの開発とは独立しています。

現段階では、計画と採否判断は親エージェント、背景の実装は実装担当、撮影・別プロセス採点・集計はCLIで行います。無限に自動反復する常駐システムではありません。実例は [loop 01の記録](../results/2026-11-27/loop-01/README.md) です。

## 手順

1. **基準を固定**: `rubric-v1.md` と `references.json`、3マップ×横／縦の撮影条件を確定。今回の反復中に重みや基準を変えません。
2. **変更前の撮影・評価**: ビルド→ソースをコミットまたは単体HTMLを凍結保存→ヘッドレス撮影→独立したCodexプロセスで画像評価。画像・計測JSON・内容ID・画像ハッシュを保存。
3. **計画**: 点数の低さだけでなく、参考と候補のどの部分に差が見えるかを記録。今回直す問題、触るファイル、受入条件を絞る。
4. **実装**: 背景担当が `src/maps/` を変更。共通カメラや採点基準を動かして点数を上げることは避ける。
5. **変更後の撮影・評価**: 同じ6条件で撮影し、会話を引き継がない新しい採点プロセスを実行。前の点数は渡さない。
6. **採否**: 根拠のある画面改善、各項目の後退、表示不具合、負荷・サイズの変化をレビュー。低下や致命的不具合があれば総点だけで採用しない。

## コマンド

```sh
npm run hd2d:build -- --page maps
npm run hd2d:preview
# 別ターミナル。Playwright Core 1.65.1とローカルChromeを使用。
# 未導入なら任意の作業用ディレクトリへ npm install --prefix /tmp/hd2d-playwright playwright-core@1.65.1
# PLAYWRIGHT_MODULE=/tmp/hd2d-playwright/node_modules/playwright-core を環境変数に指定。
# 長時間実行に制限がある環境では --maps town / forest / cave を順に実行。
# 同じ出力先の他マップの結果を保持します。同時実行はしません。
node hd-2d/scripts/visual-capture.mjs --url http://127.0.0.1:4310/maps.html --output .local/hd2d-visual-loop/baseline
node hd-2d/scripts/visual-packet.mjs .local/hd2d-visual-loop/baseline .local/hd2d-visual-loop/references .local/hd2d-visual-loop/baseline.packet.json loop-01-a
node hd-2d/scripts/visual-evaluate.mjs --packet .local/hd2d-visual-loop/baseline.packet.json --output .local/hd2d-visual-loop/baseline.review.json --dry-run
node hd-2d/scripts/visual-evaluate.mjs --packet .local/hd2d-visual-loop/baseline.packet.json --output .local/hd2d-visual-loop/baseline.review.json
# 改善後にも同じ手順で candidate.review.json を生成
node hd-2d/scripts/visual-compare.mjs .local/hd2d-visual-loop/baseline.review.json .local/hd2d-visual-loop/candidate.review.json .local/hd2d-visual-loop/comparison.json
```

`codex` がPATHにない場合は `CODEX_EXECUTABLE` に実行ファイルを指定します。既存のChatGPTログインを使い、モデルを固定指定しません。ネットワーク接続が必要です。利用環境の承認は別途適用されます。

撮影は既存ブラウザとは別の一時プロファイルを使い、SwiftShaderによるソフトウェア描画に固定します。採点に使う `*.png` は表示中のcanvasそのものです。`--raw` を指定すると、既存の「シーンPNG」書き出しも `*-raw.png` に診断用として保存します。ポスト処理の一致が保証されないため採点には使いません。

ChromeはPlaywrightの `chrome` channelで検出します。別配置の場合は `CHROME_EXECUTABLE` に指定できます。プロジェクトや公開物に端末固有の絶対パスを固定しません。

利用者の運用方針: pass/GPGのロックで配信できない場合は、解除の確認を繰り返さず、ローカル評価・改善・検証・コミットまで進めます。未配信であることを結果に記録します。

packet は次の形式です。パスはpacketからの相対パス。参考→候補の添付順はランナーが固定し、重複・欠落・不正な評価結果はエラーにします。最大12枚です。

```json
{
  "schemaVersion": 1,
  "caseId": "loop-01-a",
  "referenceImages": [{"path": "references/town.jpg", "role": "composition", "mapId": "town", "sourceUrl": "https://example.org/source"}],
  "candidateImages": [{"path": "baseline/town-landscape.png", "mapId": "town", "orientation": "landscape", "conditionId": "preset2-1280x720-dpr1-standard-static0", "contentId": "from-capture-json"}],
  "rubricPath": "../../../hd-2d/visual-loop/rubric-v1.md"
}
```

参考画像は著作物なのでローカルの比較に限り、アプリへの素材転用や配布物への同梱はしません。出典とハッシュだけをリポジトリに記録します。実行ログは `.local/` に置き、公開する記録は個人名・絶対パス・認証情報を含まないものに限ります。

## 独立性と限界

評価プロセスは `--ignore-user-config --ephemeral --sandbox read-only --skip-git-repo-check` で、リポジトリ外の一時フォルダを作業場所にします。添付画像と基準・スキーマだけをコピーし、終了後に削除します。これは会話・実装説明からの分離です。OSレベルでソースの読出し自体を禁止する隔離ではありません。実行ログでツールを使っていないことも確認します。

各項目0〜4の順序尺度を均等重みで100点に換算します。総点は採点モデルに計算させません。同じ画像でも点が揺れるため、単発の5点差を確定的な改善とは扱えません。初回の1ループは仕組みの実証です。継続運用では同一画像の再採点と、順序を入れ替えた匿名A/B比較を追加して揺れを推定します。モデルが変われば対照画像も再採点します。

`visual-packet.mjs` が計測JSONのviewport・camera・settings・time・presetVersionをハッシュ化し、比較時に条件の一致を検証します。カメラやプリセットを変えた比較は別実験です。ヘッドレスのソフトウェア描画時間は実機GPU性能やスマホ性能を示しません。採点による無人の本番反映は行わず、変更内容と画面・検証のレビューを残します。
