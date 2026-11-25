# Cloudflareの本人専用環境をコードで管理する

更新日: 2026-11-25（JST）。ドメインの取得先はCloudflare Registrar。当面は運営者だけがゲームを閲覧できる状態にする。サークル用Gmail・Cloudflareアカウント・Zero Trust Freeの準備を終え、Access設定とゲームの非公開デプロイまで完了した。本人のOTPログインとPC・スマホでのプレイ確認は残っている。

非公開URL: https://tensei-private-games.tensei-lab.workers.dev 。登録したサークル用Gmailに届くワンタイムコードでログインする。

## 最初のアカウントを分ける

個人活動と分けるため、転生魔法研究所用の独立したメールアカウントを1つ作り、Cloudflareの登録・通知・Accessログインに使う。最初から独自ドメインのメールを用意する必要はない。

- [Gmailの新規アカウント作成](https://support.google.com/mail/answer/56256?hl=ja): 使い慣れたGoogleで始める案。`tenseilab.contact` のようなサークル由来の名前が候補。空きは未確認。
- [Proton Mail Free](https://proton.me/mail/pricing): Googleの活動とサービスごと分けたい場合の代替。

メールのパスワード・回復情報・メール内の本人確認は利用者が管理する。リポジトリやチャットにパスワードを置かない。ドメイン取得後の公開連絡先は別に設定できるが、Cloudflareへ入るための元のメールは独自ドメイン障害時にも使える受信先として維持する。

## 本人が最初に行う操作

1. 専用メールを作り、受信できることを確認する。
2. [Cloudflare登録](https://dash.cloudflare.com/sign-up)を行い、確認メールからメールアドレスを認証する。アカウントの表示名もサークル名に合わせる。
3. Zero Trustの初期セットアップでFreeプランを選ぶ。ログイン用team名はサークル由来にする。現行の公式手順では、Freeでもプラン選択と支払い情報の登録が必要。これはドメイン購入やWorkers Paidへの切り替えとは別である。
4. 対象アカウントだけを操作できるAPIトークンを発行し、コード実行時の環境変数 `CLOUDFLARE_API_TOKEN` に渡す。トークンはチャットへ貼らない。Global API Keyは使わない。

アカウント作成にはメール確認がある。[Cloudflareアカウント作成](https://developers.cloudflare.com/fundamentals/account/create-account/)。Zero Trustの初回手続きは[公式セットアップ](https://developers.cloudflare.com/cloudflare-one/setup/)を参照。初期の契約・本人確認をTerraformだけで完了できるとは扱わない。

APIトークンは[公式の発行画面](https://dash.cloudflare.com/profile/api-tokens)で作る。必要な権限は、Accessアプリ/ポリシーの編集、OTPのためのOrganizations/Identity Providers/Groupsの編集、Workersの作成・配布に必要な権限。新規Worker作成には現行のWorkers Adminが必要で、既存Worker更新に使うEditorとは異なる。権限・リソース範囲は初期アカウント内に限定し、ドメイン購入・課金・D1・R2等は今回の作業に含めない。[APIトークン発行](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)、[Workers権限](https://developers.cloudflare.com/workers/authorization/workers/)

初回トークンで指定する対象は新しく作ったサークル用アカウントのみ。必要な設定は次のとおり。UIの表記が異なる場合は、権限を広げる前に表示内容を確認する。

| 権限 | 用途 |
| --- | --- |
| Workers: Admin（Workers productのアカウント内スコープ） | 最初のWorker作成と配布 |
| Access: Apps and Policies: Edit | 本人専用のAccessアプリとAllowポリシー |
| Access: Organizations, Identity Providers, and Groups: Edit | メールOTPの設定 |
| Account Settings: Read | アカウント情報の参照 |

発行した値はチャットへ貼らず、`pass`などの秘密管理ツールで保管する。環境変数で直接渡す方法や、Git追跡外の `infra/cloudflare/.env.local` に保存する方法も使える。トークンの値は読み取り確認やAPI実行時にも出力しない。

`pass`を使う場合はトークンをファイルへ保存する必要はない。`CLOUDFLARE_API_TOKEN` は空にし、`CLOUDFLARE_API_TOKEN_PASS_ENTRY` に保存項目名だけを指定する。`cf:with-env` が実行時に `pass show` の先頭行をメモリ内で読み、子プロセスの環境変数へ渡す。`.env.local` 内の `$(pass ...)` は実行されないので、この専用設定を使う。

現在のローカル設定はこの`pass`方式。以後は `npm run cf:with-env -- <command> ...` で呼び出せる。Terraformを使うコマンドでは、実行ファイルをPATHへ入れるか絶対パスで指定する。

## 管理を分ける

| 管理対象 | 方法 |
| --- | --- |
| 許可する本人のメール、OTPログイン、Accessアプリ | TerraformのCloudflare公式provider |
| 配布するゲームHTML、認証ガード、Worker設定 | Wrangler |
| 初回アカウント・メール確認・Freeプラン開始 | 本人の初回手続き |
| ドメイン取得 | Cloudflare Registrar。名前と価格を決めてから別途実行 |

TerraformとWranglerで同じWorkerコードを上書きし合う構成にしない。Terraformのstateにはメール等が含まれるため非公開で保管する。APIトークンは環境変数で渡し、追跡する設定ファイルへ埋め込まない。[Terraformで管理対象を一元化する考え方](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)

## 非公開性を維持する仕組み

初回デプロイ前に、使用する `workers.dev` hostnameをAccessアプリとして確保し、本人のメール1件だけを許可する。プレビューURLは無効にする。Worker IDの取得後に設定するWorker全体保護に比べ、hostnameの事前保護ならゲームをアップロードする前からAccessを準備できる。[hostname指定のAccess](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

その上で、配信Worker自身も次を検査してからHTMLを返す。

- 正規のhostnameであること。
- AccessのJWTの署名、発行元、対象アプリ、期限が正しいこと。
- JWTのメールが許可された本人と一致すること。
- 設定不足・鍵の取得失敗・検証失敗時はHTMLを返さないこと。

`assets.run_worker_first = true` で、静的ファイルにも必ずガードを通す。`ctx.access` はStatic Assets内部ルーターから伝わらないため、存在を前提にせずJWTを検証する。[Static Assetsのルーティング](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)

この本人専用の実装では、ゲームHTMLへのアクセスもWorkerコードを動かすためWorkersのAPI側リクエスト/CPU枠を消費する。元の計画にある「静的配信のみなら無料・無制限」とは課金経路が異なる。少人数検証で実測し、一般公開時には認証方式と配信設定を改めて設計する。

独自ドメインを追加する時はAccess設定・ガードの許可hostnameを先に更新する。別名のURLを足しただけで勝手に一般公開になる動作にはしない。公開切り替えも別の変更として管理する。

## 実行と確認

Node.js 24以上、プロジェクトの依存関係（`npm ci`）、Terraform 1.8以上を使う。Cloudflare providerは5.29.0、Wranglerは4.168.0、JWT検証用joseは6.1.3に固定している。Terraformのprovider lockfileも追跡する。

具体的な変数と実行コマンドは[インフラのREADME](../infra/cloudflare/README.md)にまとめる。設定値とTerraform state、生成したWrangler設定はGit追跡外とする。本人のアカウント準備後にplanを確認し、Accessを適用してからゲームを配布する。

| コマンド | 役割 |
| --- | --- |
| `npm run cf:with-env -- <command> ...` | Git追跡外の `.env.local` を読み、トークンを出力せず子プロセスの環境変数へ渡す |
| `npm run cf:check` | ゲームのビルド、既存コードとWorkerの型検査、認証・bootstrapのローカルテスト |
| `npm run cf:bootstrap-subdomain` | 未作成のworkers.devサブドメインだけAPIで登録。既存値が異なれば変更せず停止 |
| `terraform -chdir=infra/cloudflare init` | 固定したproviderを取得 |
| `terraform -chdir=infra/cloudflare plan` | 非公開設定の変更内容を事前確認 |
| `terraform -chdir=infra/cloudflare apply` | Accessアプリ、本人だけのAllow、OTPを適用 |
| `npm run cf:deploy:private` | チェック→Terraform出力から非公開設定生成→Wrangler配布 |

最初の設定値は `infra/cloudflare/terraform.tfvars.example` をコピーした非公開の `terraform.tfvars` へ入れる。アカウントID、サークル用workers.devサブドメイン、Zero Trust team domain、閲覧を許可する専用メールを指定する。トークンはtfvarsへ入れず、`pass`またはREADMEの非表示入力手順で環境変数に渡す。エージェントへ実行を任せる場合も `cf:with-env` 経由で使い、ログやチャットに転記しない。ローカル設定・state・生成設定は権限600で保管する。

実アカウントでの完了条件は、本人がPC/スマホからOTPで閲覧でき、未認証・許可外メール・別hostname・無効なJWTでは4本の配布HTMLを取得できないこと。ローカルテストとdry-runの成功だけで、Cloudflare上での非公開確認が済んだとは扱わない。

### 今回確認できたこと

- `npm run cf:check`: 成功。HTML4本のビルド、既存/Worker双方の型検査、追加8テストを通過。実署名付きJWTで正常系、署名・発行元・対象アプリ・期限・メールの不正、鍵取得失敗、hostname違いを確認した。`pass`の先頭行読み取り、失敗時の値非表示、環境変数優先も確認した。
- `npm test`: 既存ゲームの32テストすべて成功。ローカルポートを使うテストがあるため、制限外で実行した。
- Terraform 1.14.0で `init`、`fmt -check`、`validate`、`plan`、`apply`: 成功。本人だけのAllowポリシー、メールOTP、対象hostnameのAccessアプリの3件を作成した。
- 適用後に再度 `plan -detailed-exitcode`: 終了コード0、差分なし。
- Wrangler 4.168.0で静的アセット4本と認証Workerを実デプロイした。
- Cloudflare APIで本人のメール1件だけの許可とポリシーの紐付け、本番URLの有効化、プレビューURLの無効化を確認した。
- 実URLの `/`、`/index.html`、`/game1.html`、`/game2.html`、`/game3.html` は未ログインで全件302のAccessログイン画面へ移動し、ゲームHTMLを返さない。偽JWTを付けても遮断された。
- ローカル設定、state、生成ファイル、providerキャッシュ、Wrangler作業領域がGit追跡外であることを確認した。

本人のOTPログイン、許可外メールでのログイン拒否、PC・スマホでの実プレイは未確認。ブラウザ操作接続が使えないため、本人による確認を残す。独自ドメイン購入、有料プランへの変更、一般公開は行っていない。
