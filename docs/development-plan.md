# 非公開デプロイ・共通掲示板・Stripe応援メッセージの開発計画

調査日: 2026-11-25（JST）。対象: 転生魔法研究所の短編ゲーム群。状態: 非公開配布の実装・デプロイ済み。共通掲示板と決済は設計案で、ドメイン購入・実決済は未実施。料金・無料枠は実装・契約時にも公式情報を再確認する。

## 1. 推奨する進め方

**Workers Static Assetsでゲームを配信し、最初はCloudflare Accessで関係者限定にする。共通の承認制掲示板を先に作り、Stripeのゲスト決済を付けて「応援メッセージ」を掲載できるようにする。**

決定事項: ドメインの取得・更新はCloudflare Registrarに統一する。当面の閲覧許可は運営者本人だけとし、一般ユーザー・招待テスターにはまだ公開しない。ドメイン名と購入時期は未確定で、非公開検証は無料URLから開始できる。

初期インフラの実装は[IaCセットアップ手順](cloudflare-setup.md)を参照する。初回はTerraformでhostname指定のAccessを先に作り、Wranglerの配信WorkerでもJWTを検証する方式を採用する。以下のWorker全体保護は比較・手動設定の選択肢として残す。認証ガードを全静的ファイルで実行する本人専用構成では、静的配信にもWorkerのリクエスト/CPU枠を消費する点に注意する。

公開・認証・掲示板・決済を一度に完成させず、次の順で進める。

1. 既存ゲーム4本のHTMLを、認証付きの無料URLで検証する。
2. 作品共通のオンライン交流ページと管理画面を作る。通常投稿を無料で受け付ける。
3. Stripeのテスト環境で、支払い確認済み投稿の表示までつなぐ。
4. ドメイン・公開規約・返金運用を整えて、一般公開と実決済を段階的に有効化する。
5. 投稿数と運営体制が育ったら、承認方式やリアルタイム配信を見直す。

初期仮定は「運営1人、当面は本人のみ閲覧、低トラフィック、日本円の単発チップ」。後に招待検証を始める場合の規模は最大10人を想定する。以下の文字数・金額・保存期間はサービスの制約ではなく、変更可能な初期仕様案である。

## 2. 既存コードとの接続

| 現状 | 計画への影響 |
| --- | --- |
| `3min-rpg/scripts/build.mjs` が `dist/index.html` と `game1.html`〜`game3.html` を生成 | この4ファイルを配布対象として使う。ソース一式やリポジトリ直下をアップロードしない |
| 各HTMLはJS・CSS・画像を内包する | ゲーム本体の外部通信不要・単体HTML配布を維持する |
| ビルド時のCSPに `connect-src 'none'`・`form-action 'none'` がある | ゲームへAPI通信や外部ウィジェットを直挿ししない。オンライン交流ページへ明示的に移動するリンクを用意する |
| 記憶の葉は `tensei-lab.archive.v1` としてブラウザ内に保存 | 葉・発見はサーバー送信しない。ドメイン変更時はJSON書き出し・読み込みで移す |
| 共通UI・描画は `common/`、固有ルールは各 `gameN/src/` | 掲示板と決済はゲームルールから独立したモジュールにする |

オンライン機能を使えない時もゲームを遊べる。配布HTMLを直接開いた場合は「交流・応援はオンライン版へ」と案内する。オンラインページのCSPだけに同一originのAPIとTurnstileの必要な接続先を許可する。

## 3. Cloudflareの構成

### 採用案と比較

| 構成 | 判断 |
| --- | --- |
| **Workers Static Assets + Workers API + D1 + Access + Turnstile** | 採用案。静的ゲームと同一originのAPIをまとめ、無料URLの本番・プレビュー双方を認証で保護できる |
| Pages + Pages Functions | 静的配布だけなら簡単。ただしPagesの「previewのAccess有効化」だけでは本番の `project.pages.dev` や独自ドメインを守れない。非公開要件では追加設計が必要 |
| 外部チャットの埋め込み | 早い反面、外部会員・表示・広告・モデレーション・Stripeとの投稿対応付けに依存。今回は外部会員を増やさない方針から見送る |
| WebSocket + Durable Objects | 後続候補。初期の承認制掲示板には不要。接続管理・再送・利用量の運用を先に増やさない |

Workersは `workers.dev` の本番URLとVersion/Preview URLをAccessで保護できる。Static Assetsもその保護対象になる。静的アセット配信は無料・リクエスト無制限だが、Workerコードが動くAPI等には別の無料枠がある。[WorkersのURLとAccess](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[Static AssetsとAccess](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[静的配信の料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Pages preview保護の範囲](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

### 配置案

```text
ブラウザ
  ├─ ゲームHTML・オンライン交流ページ → site Worker / Static Assets
  ├─ /api/*                         → site Worker → D1
  ├─ /admin/*・/api/admin/*          → Access + 管理者検証 → site Worker
  └─ StripeホストのCheckout           → Stripe
                                          │ 署名付き通知
                                          ▼
                         billing-hook Worker → 同じ環境のD1
                         （POST /stripe/webhook のみ）
```

`billing-hook` はゲームや管理画面を一切配らない。決済通知には公開HTTPS到達性が必要なので、ゲーム非公開期間でもこの受信口だけを署名認証で公開する。サイト全体のAccessを解除して対応しない。独自ドメイン取得前の通知はローカルStripe CLIでの検証を先行し、外部のテスト通知を使う段階で受信口を作る。[Stripe webhookの到達性](https://docs.stripe.com/webhooks)

### 非公開のまま初回デプロイする手順

1. 公開名として支障のないサークル用CloudflareアカウントサブドメインとWorker名を決める。個人アカウント名をURLに入れない。
2. `local`・`staging`・`production` を分け、D1・秘密鍵・Turnstile設定も分離する。Version URLは本番リソースを共有するため、環境分離の代わりに使わない。
3. AccessのFreeプランとメールOTPを設定。当面は運営者本人のメールアドレス1件だけをAllowし、その他は拒否する。招待検証を始める時に限り許可アドレスを追加する。テスターはCloudflareの事業者アカウントを作る必要がない。
4. **ゲームを含まない空のWorker**を用意し、予定ホストの本番・Version/PreviewすべてへAccessを設定する。初回は `preview_urls: false` を明示し、不要な別URLを作らない。
5. 未ログイン・許可外メール・シークレットウィンドウで、HTMLにもAPIにも到達できないことを確認してからゲームをアップロードする。先にAccess設定できない経路では、空Workerまでで止め、保護確認前にゲームを送らない。
6. 再デプロイ後も同じ検証をする。Accessのセッション付き応答や管理APIを共有キャッシュに保存しない。`noindex` は追加してよいが、非公開の根拠にはしない。

OTPは追加設定が必要で、許可メールをAccessポリシーで限定する。[OTP公式手順](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)。Version URLはバージョンの設定・本番リソースを利用する。[公式仕様](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)

### 当面の本人専用サイトの設定

- Cloudflare管理画面の `Workers & Pages > 対象Worker > Access > Protect this Worker behind Access` で **All traffic** を選ぶ。Previews onlyでは本番URLが対象外になる。
- Zero Trust側で該当AccessアプリのAllowポリシーを編集し、Include条件を運営者のメールアドレス完全一致1件にする。`Everyone` やメールドメイン全体の許可を使わない。他のAllow/Bypassやパス別ポリシーが優先されないことも確認する。
- ログイン方式はメールOTP。許可アドレスでコードを受け取り、本人のPC・スマホから入れる。VPNアプリを入れる方式を初期要件にしない。
- Worker単位の保護なので、同じWorkerの独自ドメイン、`workers.dev`、有効なVersion/Preview経路も対象。静的HTMLにも適用される。不要な経路は引き続き無効化する。
- 第三者にはログイン画面または拒否応答が見え、認証を通らない相手へゲーム本文を配信しない。サイトやホスト名の存在まで隠す方式ではない。
- 保護確認前には空Workerだけを配置し、ゲームHTMLは確認後に初めてアップロードする。将来の一般公開は別の作業として扱い、ドメイン取得・接続と同時には保護を解除しない。

設定根拠: [Worker全体のAccess保護とポリシーの優先順位](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[Static Assetsも保護対象](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)。

### 一般公開への切り替え

- 本番のゲーム・掲示板閲覧だけを公開する。`staging` と管理画面/APIは引き続きAccessで保護する。
- 独自ドメインを接続したら旧 `workers.dev` とVersion URLを無効化または適切に保護する。設定ファイルにも反映し、再デプロイで経路が復活しないようにする。
- 管理APIはAccessを通ったというヘッダーの有無だけで判断しない。JWTの署名・issuer・audience・期限と管理者権限をサーバー側で確認する。Static Assets併用では `ctx.access` が利用できない場合があるため、その存在に依存しない。
- `run_worker_first` は `/api/*`・`/admin/*` に限定する案とし、同名の静的ファイルやSPAフォールバックによるAPI迂回をテストする。認証はCloudflare Accessをエッジに置き、静的配信の全件を独自認証コードで処理しない。

根拠: [workers.dev無効化と設定の注意](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[Static Assetsのルーティング](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Worker単位・パス単位のAccess](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)。非公開期間はWorker単位のAll trafficを使い、公開時は管理画面と管理APIのパス保護を先に確認してから全体保護を解除する。Accessには適用優先順位があるので、上位の広いBypassを作って管理パスまで公開しないようにする。

## 4. ドメインとURL

ドメインの取得・更新先はCloudflare Registrarで確定。初期費用を抑えるため、当初は `site.<circle-subdomain>.workers.dev` のような無料URLをAccess付きで使う。短縮URLは不要。名前の第一候補は `tensei-lab.com`、ハイフンなしなら `tenseilab.com`。名前の空きや権利は未確認。

レジストラ別の初年度・更新・3年総額と、Regeryを含む調査結果は [ドメインの選択メモ](domain-options.md) を参照する。独自ドメインは一般公開・実決済の直前までに決め、告知URLとブラウザ保存先を固定する案を推奨する。

既存テスターの葉は、旧originでJSONを書き出して新originへ読み込む。旧originに書き出し用ページを残す期間は、そのページを一括リダイレクトの対象にしない。チャットはD1に保存するため、同じデータベースを使えばドメイン移行で失われない。Cookieは再発行し、Stripeの戻り先・Access・Turnstile許可ホストも更新する。

## 5. 汎用チャットの初期仕様

### 最初は「研究所の掲示板」

通常の無料投稿と、有料の応援メッセージを同じ一覧に表示する。リアルタイムチャットのUIを約束せず、**全件承認制・時系列表示・短い文章**から始める。常時監視が難しい個人運営を想定した推奨仕様である。

| 項目 | 初期仕様案 |
| --- | --- |
| 部屋 | `lobby`・`game1`・`game2`・`game3`。ゲームIDと部屋IDを設定で追加できる |
| 投稿者 | アカウント登録不要。任意の表示名20文字、本文1〜200文字。未入力名は「旅人」 |
| 投稿種別 | 無料の感想、質問、不具合報告、Stripe応援メッセージ。支払いなしの参加を常に残す |
| 公開 | 通常投稿も有料投稿も承認後。投稿者自身には「確認待ち」を表示し、他の閲覧者には返さない |
| 更新 | 初回20件、カーソルで追加取得。表示中のみ20秒間隔の差分取得、タブ非表示で停止、失敗時は間隔を延ばす |
| 初期除外 | DM、画像・添付、HTML/Markdown、URLリンク化、ユーザー検索、返信ツリー、公開ランキング |
| 有料表示 | 「応援ありがとう」バッジ。金額公開は明示同意制、非公開が既定。金額による投稿権限の差は付けない |
| ゲーム内 | 「掲示板・応援」へ移動するリンク。ゲーム進行を止める強制表示や購入誘導は入れない |

「汎用」は各ゲームの進行・勝敗に依存しない部屋別メッセージAPI、共通UI、投稿管理を指す。今回の段階で他サークルへのサービス提供・売上分配・マルチテナント化は行わない。

### 禁止ワードだけに依存しない運用

1. 全件承認制に加え、投稿・Checkout作成時にTurnstileをサーバーで検証する。クライアントの表示だけでは防御にならない。
2. 本文の正規化（NFKC、制御文字・連続空白の整理）を検査用に行い、少数の禁止語・URL・連投・同文投稿を検出する。禁止語は隔離の補助に使い、誤検知を管理画面で救済する。具体的な悪用語の一覧を配布JSに置かない。
3. 投稿とCheckout作成は、ゲストセッション・IP由来の短期識別子・部屋単位でレート制限する。初期案は投稿30秒間隔、Checkout作成は1分3回。IPだけで恒久的に利用者を特定・排除しない。
4. Workers Rate Limiting bindingは拠点ごとの近似制限である。厳密な連投制限はD1の条件付き更新で担保し、上流制限を唯一の根拠にしない。
5. 投稿本文はプレーンテキストとして描画し、HTMLとして挿入しない。SQLはパラメーター化する。CSRFはOrigin検証とCSRFトークンで対処し、CORSは同一originに限定する。
6. 管理画面に承認・非表示・拒否・通報処理・一時投稿停止・部屋閉鎖を用意する。支払った投稿にも同じ基準を適用する。管理操作は監査記録を残す。

[Turnstileサーバー検証](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)、[Rate Limitingの近似性](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[D1のバインドAPI](https://developers.cloudflare.com/d1/worker-api/d1-database/)。

公開前に、禁止内容・掲載判断・通報窓口・削除依頼・返金方針を短い利用ルールとして表示する。「禁止ワードがあるから監視不要」とはしない。初期は1日1回以上確認する運用案とし、対応できない期間は投稿と新規支払いの受付を止め、閲覧は維持できるようにする。

### ゲストと個人情報

- 256bit相当のランダムなゲストトークンを発行し、`HttpOnly; Secure; SameSite=Lax` Cookieに保存。サーバーにはハッシュを保存する。仮の有効期間は7日。
- ゲストCookieは恒久会員や本人確認ではない。Cookie削除・別端末では同じ投稿者として復元できない。表示名は誰でも入力できるため本人性を保証せず、「運営」等の予約名は管理者のみ使えるようにする。
- 閲覧APIに決済メール、Stripe顧客ID、IP、ゲスト識別子を含めない。支払い状態照会と通報履歴も投稿者または管理者に限定する。
- アプリでは生IP・決済情報全体を保存しない。荒らし対策のIP由来識別子は秘密鍵付きHMAC・短期ローテーション・最大7日保存の案とする。Cloudflare/Stripe側のログ保存は別に確認し、プライバシー説明へ反映する。
- 仮の保存方針は、失効した未払い原稿7日、通常投稿1年、通報・運営ログ90日。決済照合記録は会計上必要な期間を実決済前に決定し、投稿本文とは切り離す。削除とバックアップ復旧で非公開投稿が再公開されない手順も作る。

## 6. Stripeでスパチャ相当の機能を作る

### Payment LinksとCheckout APIの使い分け

**単独のチップ窓口ならPayment Linksで十分。掲示板の投稿と正確に結び付ける今回の完成形では、サーバー側でCheckout Sessionを作る。**

Payment Linksには自由金額とカスタム入力欄があるが、固定リンクだけでは投稿の事前検査・原稿の固定・部屋への対応付け・ゲスト所有権の検証をまとめにくい。試作だけPayment Linksを使うことは可能だが、二重の支援窓口を必須にはしない。[Payment Links作成](https://docs.stripe.com/payment-links/create)、[カスタム入力欄](https://docs.stripe.com/payment-links/customize)、[Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)

プレイヤーにBMC・Ko-fi・事業者用Stripeアカウントを作らせない。カードのゲスト決済を基本とし、Linkによる情報保存は任意にする。メールやカード認証はStripe画面で求められる場合があり、「個人情報入力が全く不要」とは案内しない。[ゲスト決済](https://docs.stripe.com/payment-links/post-payment)、[Link](https://docs.stripe.com/payments/link)

既存の採用例として、無料ブラウザゲーム群の [Quiet Games](https://quietgamespace.com/support) は自サイトの金額別ボタンからStripeへ直接送っている。[Zumbi Blocks 2の開発者告知](https://steamcommunity.com/app/1941780/announcements/) でもゲームメニューからStripeへ送る任意支援が案内されている。これらはStripe直結の支援導線の実例であり、本計画の掲示板連携や日本での利用可否を保証するものではない。

### 決済から掲載まで

1. 投稿者が表示名・本文・部屋・金額・金額公開の同意を入力する。金額候補は100/300/500/1,000円、自由入力は100〜5,000円、単発・JPYのみの案とする。
2. Workerがゲスト所有権、Turnstile、文字数、禁止内容、金額整数・範囲を検証する。原稿をD1に保存し、その本文・部屋・金額・同意のスナップショットを固定する。決済後に無検査で本文を編集できないようにする。
3. Workerがサーバー側の金額でCheckout Sessionを作り、内部 `tip_order_id` を `client_reference_id` / metadataに設定する。PaymentIntent側にも照合IDを明示的に設定する。クライアントが送る `paid` やStripe価格IDを信用しない。作成再試行は注文ごとのIdempotency-Keyを使い、同じ注文に複数の有効Sessionを作らない。
4. Stripeホストの画面でカード決済する。カード情報は自サイトに入力・保存しない。キャンセル・Session失効時は未払いのまま残し、勝手に公開しない。
5. `billing-hook` が署名付き通知を検証し、Session・PaymentIntent・注文ID・金額・通貨・環境が一致し、実際に支払い済みであることを確認する。
6. DB更新後、投稿者画面は「支払い完了・掲載確認待ち」と表示する。運営が承認した場合だけ、通常一覧に有料バッジ付きで1件表示する。
7. 帰還画面は自分の注文状態を照会するだけ。戻りURLへの到達や `session_id` の所持だけで支払い完了と認定しない。決済後にブラウザを閉じても通知で反映できるようにする。

APIのamountはJPY整数（500円なら500）で扱う。StripeのJPY最小額とアプリの最低100円は区別する。[通貨仕様](https://docs.stripe.com/currencies)、[作成の冪等性](https://docs.stripe.com/api/idempotent_requests)、[掲載等の購入後処理](https://docs.stripe.com/checkout/fulfillment)

### 支払いと投稿の状態は分離する

| 状態軸 | 例 | 表示条件 |
| --- | --- | --- |
| 掲載 | `pending / approved / rejected / hidden` | 通常投稿はapprovedだけ公開 |
| 支払い | `created / checkout_open / paid / expired / refund_pending / refunded / disputed` | 応援投稿はapprovedかつpaid、返金・異議申立ての保留なしの場合だけ公開 |

`paid` は掲載承認を意味しない。支払い済みでも規約違反で拒否した場合は全額返金する初期方針案とし、その条件を決済前に示す。受付から7日以内に掲載判断できなければ返金対象として運営に通知し、新規受付を止める。初期の返金操作はStripe Dashboardから行い、申請しただけで完了扱いにせず通知/APIで実際の結果を照合する。部分返金・異議申立ては自動で再掲載せず、管理者判断待ちにする。[返金処理](https://docs.stripe.com/refunds)

返金時に元の決済手数料は戻らないため、その費用は運営負担として見込む。内容確認が追い付かない間は支払い受付を止め、返金を繰り返す運用にしない。

### 通知の重複・遅延・順序逆転

- raw bodyと `Stripe-Signature` を公式SDKで検証し、時刻許容範囲も確認する。JSON変換後のbodyで署名検証しない。
- `stripe_event_id` と `stripe_checkout_session_id` に一意制約を置く。別イベントIDでも同じ決済に二重適用しない。
- 検証済みイベントをD1のinboxへ永続化してから2xxを返す。保存失敗時は非2xxで再送対象にする。inboxに `received / applied / failed` と試行数を持たせ、Cronで未処理を再試行する。未反映のイベントを既処理として捨てない。
- 外部Stripe API照合後、D1のbatchと条件付き更新で注文変更・投稿状態・イベント適用記録を原子的に確定する。ネットワーク呼び出しをDB更新の途中に挟まない。
- 到着時刻だけで上書きしない。返金済みに遅い成功通知が来てもpaidへ戻さない。必要ならStripeの現在状態を取得し、注文ごとの更新競合を検知して再照合する。
- MVPは即時のカード決済に絞る。それでも `checkout.session.completed` という名前だけでpaidと判断しない。将来遅延決済を増やす時は非同期成功・失敗イベントも追加する。
- `staging` はStripe sandbox/testのみ、`production` はliveのみ。秘密鍵・通知署名鍵・D1・注文IDを環境分離し、`livemode` 不一致は反映しない。
- 日次で未処理通知・paid未反映・返金保留を照合し、DB復旧後はStripeの決済と再突合する。定期ジョブが止まった時は管理画面で検知できるようにする。

通知の重複・順序・再送等は [Stripe webhook公式](https://docs.stripe.com/webhooks)、D1のbatchは [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) を参照する。

## 7. 実装対象の切り出し

以下は将来作るファイル案であり、今回作成したものではない。

```text
web/                         # オンライン交流・応援・規約・管理画面
platform/
  site/src/                  # メッセージAPI、Checkout作成、管理API
  billing-hook/src/          # 署名検証、決済通知inbox、反映・再照合
  shared/                    # 検証、投稿状態、決済状態、DTO
  migrations/                # D1 schema、インデックス
  tests/                     # API、モデレーション、決済状態の検証
  wrangler.site.jsonc         # staging / production、静的assetsとD1
  wrangler.billing.jsonc      # 外部通知のみ、同じ環境のD1
scripts/build-web.mjs         # 既存4HTMLとwebページを配布用に組み立てる
dist-web/                    # 配布物のみ。Git追跡外
```

ゲーム用の小さなパッカーはそのまま使い、オンラインUIのビルドは別にする。Wrangler・Stripe SDK・オンラインUIのビルドツールは実装時に現行互換性を確認し、バージョンとlockfileを固定する。`dist-web/` のallowlist方式で、`.env`・秘密鍵・テストデータ・ソースマップ・端末パスを配布物へ混ぜない。ゲームの4HTMLはルートと同じ階層に維持し、作品間リンクを壊さない。

| データ | 主な内容 |
| --- | --- |
| `rooms` | 部屋ID、ゲームID、投稿受付フラグ |
| `guest_sessions` | token hash、有効期限、停止状態 |
| `messages` | 部屋、表示名、本文、所有者、掲載状態、種別、公開日時 |
| `tip_orders` | 投稿スナップショット、整数金額・通貨、公開同意、Session/PaymentIntent ID、決済状態・返金額 |
| `stripe_event_inbox` | 一意イベントID、対象注文、必要最小の照合情報、処理状態、再試行情報 |
| `reports / moderation_actions` | 通報、判断理由、操作者、監査日時 |

部屋・掲載状態・公開順に索引を作る。ページングは公開時に発行する単調なカーソルを使い、後から承認された古い投稿も差分取得から漏れないようにする。非表示・返金後の削除も差分イベントで伝えるか定期再取得し、一覧に残り続けないようにする。

API案: `GET /api/rooms/:id/messages`、`POST /api/messages`、`POST /api/tips/checkout`、`GET /api/tips/:id/status`、`POST /api/reports`、管理者専用 `/api/admin/*`。投稿・通報・注文APIは本文サイズと件数を制限し、管理API全体を管理画面と同じAccess/JWT検証対象にする。

## 8. 工程・工数・受入条件

工数は既存ゲームを流用し、1人で実装・確認する場合の概算。1人日=約6時間の集中作業。サービス審査・ドメイン手続きの待ち時間は別で、確約日程ではない。

| 段階 | 工数目安 | 成果物と完了条件 |
| --- | --- | --- |
| P0 配布と非公開化 | 1〜2人日 | 配布用組立・Wrangler設定・staging。許可テスターだけが4HTMLを開ける。無料URL、Version/Preview、APIの迂回不可。PC/スマホで3作・葉保存を確認 |
| P1 無料掲示板と管理 | 3〜4人日 | 部屋別投稿、Turnstile、レート制限、承認・通報・停止。登録なしで投稿でき、未承認文・個人情報が公開APIへ出ない。XSS・CSRF・連投を検証 |
| P2 Stripeテスト連携 | 3〜5人日 | Checkout、署名検証、inbox、返金反映、再照合。重複・順序逆転・通信断で二重掲載/誤認定しない。実請求なしで通し確認 |
| P3 公開準備 | 1〜2人日 | ドメイン、保存データ移行、規約・問い合わせ・掲載/返金ルール、バックアップ復旧訓練、費用/障害監視。管理とstagingは非公開のまま |
| P4 一般公開・実決済 | 0.5〜1人日 | ゲーム公開→無料投稿→少人数の実決済の順で有効化。運営者が実際の受取表示と返金を確認。問題時は決済と投稿を別々に停止できる |

初期リリースまで合計約9〜14人日。最初の区切りはP0のみとし、非公開のURLでゲームを触れる状態を作ってから次へ進む。チャットの即時公開や自動AI審査、WebSocket化はこの工数に含めない。

### 実装時の検証

- 既存の `npm run build`・`npm test`・`npm run typecheck` を継続する。オンライン用チェックは別途追加し、配布HTMLの外部通信不要も回帰確認する。
- 非公開の本番・preview・version・独自ドメインとAPIを、未ログイン/許可外/許可済み/一般公開後の管理者で実測する。HTTPステータスだけでなくHTML本文の漏えいも確認する。
- 投稿はスマホ幅、キーボード、空欄、Unicode、長文、URL、HTML、通報連投、期限切れTurnstile、未承認投稿の照会、ゲスト所有権の変更を確認する。
- 決済は成功・キャンセル・認証失敗・二重クリック・APIタイムアウト・失効・金額改ざん・他人の注文照会・署名不正・重複同時通知・逆順通知・DB失敗・返金保留/失敗/成功・異議申立てを検証する。
- 支払い後にブラウザを閉じても反映する。未払い注文へ偽のsuccess URLを開いても掲載されない。運営が拒否した支払い済み投稿は返金処理へ進み、別投稿に差し替えられない。
- ロールバックはコードとDBを別に扱う。前方互換のschema変更を優先し、バックアップ復旧後のStripe再照合と非表示状態復元を確認する。

## 9. 費用と運用上限

| 項目 | 初期費用・無料枠 | 判断 |
| --- | --- | --- |
| 静的ゲームHTML | Static Assetsへのリクエストは無料・無制限 | APIや独自認証でWorkerを起動する分は別 |
| Workers API | Free: 100,000リクエスト/日、CPU 10ms/呼出。Paidは最低$5/月＋超過分 | 無料から計測。暗号処理・Stripe SDKを含めCPUも実測し、上限前に見直す |
| D1 | Free: 読取500万行/日、書込10万行/日、合計5GB | クエリ数でなく走査・索引更新を含む行数。適切な索引と取得上限が必要 |
| Access | 小人数のFree運用を想定 | 無料席数・契約条件は設定時再確認。一般公開ユーザーを全員Accessに登録しない |
| Turnstile | Freeプランあり | 検証トラフィックだけでなくWorker/API側の消費も見る |
| Stripe | 日本の標準カード決済3.6%。Checkout/Payment Linksは標準料金で追加利用料なし | 他の決済手段・為替・追加製品は別条件。500円なら基本手数料18円 |
| 独自ドメイン | 年額。別資料を参照 | 初年度割引より3年総額で判断 |

出典: [Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)、[D1料金](https://developers.cloudflare.com/d1/platform/pricing/)、[Accessプラン](https://www.cloudflare.com/plans/zero-trust-services/)、[Turnstileプラン](https://developers.cloudflare.com/turnstile/plans/)、[Stripe日本料金](https://stripe.com/jp/pricing)。

ポーリング20秒なら閲覧者1人・1時間で約180回。50人が各2時間/日なら約18,000回/日、100人が24時間接続すると約432,000回/日となり、他APIを除いてもWorkers Free枠を超える。初期は非表示タブ停止と利用量計測を入れ、上限50/80%を運用の見直し目安にする。課金プランへ勝手に切り替わることを前提にせず、プランと上限時の停止動作を確認する。

WebSocket化が必要になったらDurable ObjectsのSQLiteバックエンドとHibernation APIを比較する。Freeでも利用可能だがリクエスト・稼働時間等に上限があるので「リアルタイム化すれば必ず安い」とはしない。[Durable Objects料金](https://developers.cloudflare.com/durable-objects/platform/pricing/)。現行のWorker単位AccessはWebSocket接続に対応しないため、非公開リアルタイム機能ではhostname単位Accessへ保護方式を見直し、迂回経路を再検証する。[Accessの制限](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

D1 FreeのTime Travelは過去7日が対象。デプロイ前の復旧点確認、schema変更前のエクスポート、復旧訓練を実施する。バックアップは静的配信ディレクトリや公開Gitへ置かない。[D1復旧](https://developers.cloudflare.com/d1/reference/time-travel/)

## 10. 実決済・一般公開までに確定する事項

計画作成には未決定のままで支障がないが、該当段階の実装・運用開始までに決める。

| 決めること | 推奨初期値 | 決める時期 |
| --- | --- | --- |
| テスターと管理者 | 当面は運営本人のみ。招待検証を始める際に許可先を追加。実アドレスは非公開ローカル設定/stateとCloudflare設定に保持し、Gitへ入れない | P0設定前 |
| ドメイン | 無料URLで開始、公開前に通常価格の `tensei-lab.com` 等 | P3 |
| 投稿公開方式 | 全件承認。対応できない間は受付停止 | P1 |
| 金額・公開表示 | 100〜5,000円、単発JPY、金額公開は任意 | P2 |
| チップの扱い | 提供したゲームコンテンツへのチップと掲載ルールを明示 | live審査・P4前 |
| 返金・問い合わせ | 掲載拒否は全額返金、7日判断期限の案。連絡窓口と対応者を決定 | P3 |
| データ保持 | 本文と決済記録を分離し、削除・会計・監査に必要な期間を確定 | P3 |

Stripeは日本で個人への寄付をサポートせず、チップは提供済みコンテンツ等に対するものである必要がある。名称を変えるだけで条件を満たしたと扱わず、実際のゲーム・メッセージ掲載・返金の内容を説明して利用可否を確認する。[Stripeのチップ・寄付条件](https://support.stripe.com/questions/requirements-for-accepting-tips-or-donations?locale=ja-JP)

決済事業者への本人確認情報と、利用者に見える公開名・明細・領収書・必要な販売者表示は別に点検する。公開コードへ実名・個人アカウント・端末パスを入れないというプロジェクト方針を守り、法令・契約上必要な表示については実決済前に適切な方法を確認する。ドメイン購入・有料プラン契約・live決済・一般公開は、この計画を作る作業には含まれない。

## 11. 今回の確認結果

計画文書に加え、本人専用デプロイのTerraform、Wrangler用認証Worker、補助スクリプトとテストを追加した。ゲームのルールは変更していない。実アカウントへAccess設定を適用し、ゲームを非公開デプロイした。P0の残作業は本人のOTPログインとPC・スマホでの受入確認。

- `npm run build`: 成功。単体HTML4本を生成。
- `npm run typecheck`: 成功。
- `npm test`: 32件すべて成功。ローカルポートを使うため、実行環境の制限外で確認した。
- `npm run cf:check`: 成功。Workerの型検査と追加8テストを含む。
- Terraformのfmt・validate・plan・applyとWrangler実デプロイ: 成功。未認証と偽JWTによるゲーム取得の遮断、プレビューURL無効化を確認。詳細は[IaCセットアップ手順の検証記録](cloudflare-setup.md)を参照。
- 文書内のローカルリンク、コードフェンス、端末の絶対パスが含まれないことを確認。

Cloudflare上の本人OTPログイン・許可外メールの拒否・スマホ実機・Stripe sandbox通し決済は未検証。各段階の受入条件として残す。
