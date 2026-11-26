# HD-2D実験室

3D背景と大型キャラクターの描画・制作方式を比較する独立した実験プロジェクトです。既存の短編ゲーム試作`3min-rpg/`と並べて、この`hd-2d/`で開発します。

実験本体は調査・計画段階です。Cloudflareへの配信確認用の入口を用意し、今後の実験HTMLも同じ経路で更新します。

詳細は[背景・大型キャラクター実験計画](../docs/hd2d-experiment-plan-2026-11.md)を参照してください。

## 方針

- 商用利用を含め無料で使えるツールに限定します。
- Babylon.js＋TypeScriptで共通実験基盤を作り、外部通信不要の単体HTMLへまとめます。
- 背景は2D配置データに高さ・形状を指定して立体化します。
- 同じボス原型を、部位別3D・事前レンダースプライトで比較します。2Dパーツ方式は必要に応じて追加します。
- 共通のカメラ・照明・動作時刻・アセット契約を固定した後、背景とキャラ各方式を並行開発します。
- 依存・ビルド・出力はこのディレクトリ内で管理し、配布物は`dist/`へ生成します。

最初の実装単位は、床・柱・動く仮ボス、3Dと仮スプライトの切替、カメラ・照明・再生時刻の制御、単体HTML化までです。

## ビルドと非公開デプロイ

リポジトリのルートで実行します。

```sh
npm run hd2d:build
npm run cf:check
npm run cf:with-env -- npm run cf:deploy:private
```

`hd2d:build`はこのプロジェクトだけをビルドし、`hd-2d/dist/index.html`を生成します。現時点では配信確認用の入口で、3D実験本体はまだありません。ルートの`npm run build`は従来どおり`3min-rpg/`用です。

`cf:check`は両プロジェクトのビルドと検証、Cloudflare配布用HTMLの集約を行います。`cf:deploy:private`は検証後、既存のゲームとHD-2D実験を一緒に更新します。認証情報とTerraformの準備は[CloudflareのREADME](../infra/cloudflare/README.md)を参照してください。

配信先は既存の本人専用環境の[/hd-2d/](https://tensei-private-games.tensei-lab.workers.dev/hd-2d/)です。登録したサークル用メールに届くワンタイムコードでログインします。プレビューURLは無効にし、このパスにも既存のAccess認証とWorkerのJWT検証を適用します。

ビルド後は`hd-2d/dist/index.html`をPCのブラウザで直接開いて入口を確認できます。スマホでは上記Cloudflare URLを利用します。将来追加する実験も、このディレクトリの`dist/`直下へ自己完結したHTMLとして出力します。
