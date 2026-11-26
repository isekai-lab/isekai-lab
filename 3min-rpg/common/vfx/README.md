# 魔法エフェクトカタログ

無料公開された画像アニメーションを、tsParticles 4.6.0で再生する共通データです。
既存素材のコマ順・色・透明背景を使い、パラメーターだけで魔法の動きを作り直すことはしていません。

## 見る・書き出す

ルートで `npm run build` を実行し、`3min-rpg/dist/effect-catalog.html` をブラウザで開きます。
`npm run preview` を使う場合は `http://localhost:4173/effect-catalog.html` です。
画像・エンジン・設定を単体HTMLに内包しているので、直接開いても外部通信なしで再生できます。
種類を選んで再生し、採用したいエフェクトの画像込みJSONを書き出せます。
書き出し形式は `isekai-lab.magic-effect.v1` で、`effect` に画像と素材情報、
`emitter` にtsParticlesの発生設定、`loader` に必要な描画拡張、`provenance` に出典を含みます。

## データと再生処理

- `generated/magic-effects.ts`: 画像をdata URIにしたカタログ。
- `generated/magic-effects.manifest.json`: 元ファイル・出典・ハッシュ・フレーム情報。
- `sprite-sheet.ts`: tsParticlesのカスタムshapeとしてシートを再生する共通処理。
- `magic-effects.ts`: カタログ、エミッター設定生成、再生ヘルパー。

tsParticles標準の画像shapeは静止画用のため、連番再生には `installSpriteSheetShape` を一度登録します。
書き出したJSONだけを拡張なしのtsParticlesへ渡しても、シートは再生できません。
配布先にもこの描画処理とtsParticlesのフルbundleが必要です。

```ts
import { installSpriteSheetShape } from './sprite-sheet.ts';
import { MAGIC_EFFECTS, playMagicEffect } from './magic-effects.ts';

// tsParticles と loadFull は同梱のフルbundleが提供します。
// エンジン初期化前にshapeを登録します。
installSpriteSheetShape(tsParticles);
await loadFull(tsParticles);
const container = await tsParticles.load({
  id: 'magic-stage',
  options: {
    fullScreen: { enable: false },
    emitters: [],
    particles: { number: { value: 0 } },
  },
});
await playMagicEffect(container, MAGIC_EFFECTS[0], { x: 50, y: 50 });
```

ホスト要素には幅と高さを設定します。座標はその領域内の百分率です。
初回は画像の読み込みを待ってから発生させます。アニメーションは一度再生して終了します。
既存戦闘の演出への割り当ては、採用する種類を選んでからゲーム側で行います。

## 出典とライセンス

確認日: 2026-11-25。以下の各配布ページのLicense(s)がCC0であることを確認しました。
CC0は画像素材に適用されます。エンジンはMITで、プロジェクト全体のライセンスとは別です。

| 素材集 | 作者の公開名 | 公式配布ページ | 内容 |
| --- | --- | --- | --- |
| Animated particle effects #1 | para | https://opengameart.org/content/animated-particle-effects-1 | 14種。炎・煙・輪状の演出。元は1024×1024、8×8、64コマ、30fps。 |
| Animated particle effects #2 | para | https://opengameart.org/content/animated-particle-effects-2 | 泡・炎・転移の9種を採用。血しぶきは除外。元は1024×1024、8×8、64コマ、30fps。 |
| 2D Spell Effects | Mikodrak | https://opengameart.org/content/2d-spell-effects | 火球・炎の斬撃・雷球・雨など10種の連番PNG。付属GIFの通常コマ時間30msを再生速度の根拠にします。最後のコマのループ待機時間は除外しています。 |

公式ダウンロード:

- https://opengameart.org/sites/default/files/para_CC0_particlefx-1.zip
- https://opengameart.org/sites/default/files/para_CC0_particlefx-2.zip
- https://opengameart.org/sites/default/files/FX.zip

ライセンス: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)。
著作権上、商用利用・改変・再配布が可能です。作者の支持・公認を表すものではありません。
元素材集に含まれる色・視点違いも別エントリーとして残しています。収録数は独立した魔法の種類数とは異なります。
分類・表示名は、取り込み時の見た目に基づく整理です。

取得したZIPのSHA-256（ファイル名は公式配布名）:

```text
para_CC0_particlefx-1.zip  5c0be385e907d3c0db99b82be0fae43174b3cfe3a8b45d7734585c685dd1187f
para_CC0_particlefx-2.zip  469676f3fc08509e4ec824147d179a51a9a71c380a3d0fd142cf8e30355f50f8
FX.zip                    8d0c09487ab0337867e90333e9c26e455760b31414bf503bedcde94b0cddbc30
```

## 追加・再生成

`3min-rpg/scripts/import-magic-effects.mjs` が変換スクリプトです。
元ZIPは上記の公式配布元から取得し、次の順でパスを渡します（ルートにZIPを置いた場合の例）。

```sh
node 3min-rpg/scripts/import-magic-effects.mjs \
  para_CC0_particlefx-1.zip para_CC0_particlefx-2.zip FX.zip
```

再変換時のみPython 3とPillowが必要です。Nodeの入口から同じディレクトリのPythonスクリプトを呼び出します。
33件を64×64pxのコマにそろえ、シートへ詰めます。コマ順・縦横比・アルファを保ち、
縦長・横長の画像は余白を透明にして中央へ配置します。paraのシートはコマごとに切り出して縮小し、隣のコマとの色の混入を防ぎます。
変換後のデータをコミットするため、通常の `npm run build` では素材のダウンロードや画像変換は不要です。

別の素材集を増やすときは、配布ページで利用・改変・再配布の条件を確認し、
変換スクリプトへ対象ファイル、表示名、分類、レイアウト、fpsを追加します。
新しい形式はフレーム数と並び順も確認し、出典・元ファイルのハッシュと変換内容をmanifestへ残します。
エンジン固有の3D素材やシェーダーは、このPNGシート変換の対象にはなりません。

変更後は `npm run build`、`npm run typecheck`、`npm test` を実行し、
PCとスマホの表示幅でプレビューの再生・終了・書き出しを確認します。
