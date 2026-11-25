# 公開用ドメインの選択メモ

調査日: 2026-11-25（JST）。対象は転生魔法研究所（`tensei-lab`）の短編異世界ゲーム3作。ここでの候補名の空き状況、プレミアム価格、商標の有無は**確認していない**。購入・登録・デプロイもしていない。

## 結論

**決定事項: ドメインの取得・更新はCloudflare Registrarに統一する。** ドメイン名はまだ未確定で、第一候補は `tensei-lab.com`。空き・権利・取得時価格は購入前に確認する。

当面は **Workers Static Assets + Cloudflare Access** の無料 `workers.dev` URL で運営者だけが検証し、公開直前に通常価格と名称を再確認して独自ドメインを1つ取得する。Worker単位の Access は production・Version URL を含む関連 URL 全体に適用でき、将来は同一 origin に掲示板 API を足せる。`tensei.games` は作品性は伝わるが、Cloudflare の公表価格では `.com` より年 $15.03 高い。

非公開の検証に URL の推測困難さだけを頼ってはいけない。`*.pages.dev` / `*.workers.dev` と短縮 URL は公開 URL であり認証ではない。Workers は [Worker単位の Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) を production と Version URL の両方に有効化する。Pages の preview 保護だけでは `<project>.pages.dev` の production URL や独自ドメインを自動的には保護しない。Pagesを使うなら、独自ドメイン側の Access と `pages.dev` から独自ドメインへのリダイレクトなど、迂回 URL を閉じる追加設計が必要である。[Pages の公式注意とリダイレクト手順](https://developers.cloudflare.com/pages/configuration/custom-domains/#disable-access-to-pagesdev-subdomain)

## 名称候補

|候補|意図|判断|
|---|---|---|
|`tensei-lab.com`|既存表記と最も一致。読みやすい|第一候補|
|`tenseilab.com`|ハイフンなしで入力しやすい|次点（`tensei-lab.com` と混同しうる）|
|`tensei.games`|ゲームサイトだと一目で分かる|費用を許容できる場合のブランド案|
|`isekai-lab.com`|リポジトリ名と一致|技術名寄りの代替案|
|`tensei-lab.games`|名称の一貫性が高い|長め・費用を要確認|

取得前に、レジストラの検索結果で「通常価格・更新価格・プレミアム表示」を確認し、必要なら対象地域・分野の商標データベースも別途確認する。候補提示は権利上の使用可能性を保証しない。

## レジストラ比較（通常の `.com` 1年）

金額は USD。各社の公式公開ページで確認した、非プレミアム・1年登録の表示額である。3年総額は `初年度 + 更新 x 2`（Spaceship は `.com` の ICANN fee も年ごとに加算）。税、為替、決済手数料、プレミアム名、将来の価格改定、回復（redemption）費用を含まない。従って発注時のカート表示を最終値とする。

|事業者|初年度|更新（年）|3年総額|実務上の特徴・確認結果|
|---|---:|---:|---:|---|
|[Cloudflare Registrar](https://pricing.registrar.cloudflare.com/)|$11.17|$11.17|$33.51|原価（registry/ICANN list price、マークアップなし）方針。取得中は Cloudflare ネームサーバーから他社 DNS へ変更不可という制約がある。[公式の制約](https://developers.cloudflare.com/registrar/get-started/register-domain/)|
|[Porkbun](https://porkbun.com/products/domains/com)|$11.81|$11.81|$35.43|公式ページは非プレミアム1年の登録・更新・移管価格として表示し、ICANN 等の料金込みとする。WHOIS privacy も無料と案内。|
|[Regery](https://regery.com/en/domains/zone/com)|$10.99|$11.49|$33.97|公開 `.com` 価格表の Purchase / Renew 表示。ICANN fee は同社の[価格一覧](https://regery.com/en/domains/prices/c)では込みと案内。通常名・税等を前提とする。|
|[Spaceship](https://www.spaceship.com/domains/gtld/com/)|$9.48 + $0.20|$10.68 + $0.20|$31.44|表示額に `.com` の ICANN 年額 $0.20 が購入時に加算される。3年は `(9.48 + 0.20) + (10.68 + 0.20) x 2`。4社中この前提では最安だが、カートで最終額を確認する。|

Cloudflare の同じ公式表では `.games` は初年度・更新とも $26.20、3年 $78.60（`$26.20 x 3`）。`.game` は $330.20/年であり候補にしない。Cloudflare は「原価で販売」とする一方、レジストリ価格が変われば表示価格も変わり得るため、固定価格の約束ではない。[価格表](https://pricing.registrar.cloudflare.com/)、[原価方針](https://developers.cloudflare.com/registrar/)

小額 TLD は初年度のキャンペーンだけで決めない。例えば Cloudflare の通常 `.xyz` は初年度・更新とも $13.50、3年 $40.50で、現在の同社 `.com` 3年 $33.51 より高い。`tensei-lab.xyz` は空き・商標とも未確認の比較候補にとどめる。常に初年度だけでなく更新額と3年総額で比較する。[Cloudflare 価格表](https://pricing.registrar.cloudflare.com/)

### Cloudflare を選ぶ場合の DNS 制約

Cloudflare Registrar で新規取得したドメインは Cloudflare ネームサーバーを使い、他の DNS 事業者のネームサーバーには変更できない。[公式仕様](https://developers.cloudflare.com/registrar/get-started/register-domain/) これは Pages/Workers を使う本件には整合するが、将来「DNS を完全に別サービスで管理する」必要が出たときはレジストラ選択を見直す。

**この制約は、他社レジストラへの移管禁止という意味ではない。** Cloudflareは移管用のアンロック・Auth/EPPコード発行に対応している。現行の公式案内では、新規登録・前回移管・登録者情報変更から60日以内は移管できない場合がある。条件を満たしたらロック解除→コード発行→移管先で申請→Cloudflareで承認の順で進める。TLD固有条件と移管先の費用は手続き時に再確認する。[Cloudflareからの移管手順](https://developers.cloudflare.com/registrar/account-options/transfer-out-from-cloudflare/)

### 比較資料: Spaceshipで取得してCloudflareで運用する案（今回は不採用）

登録・更新はSpaceship、DNSと配信はCloudflareに分けられる。Spaceshipは外部ネームサーバーへの変更に対応しており、Cloudflareの指定NSを設定すればよい。今回採用するWorkers Custom DomainにはactiveなCloudflare zoneが必要で、Spaceship側DNSにCNAMEだけを置く設計にはしない。[SpaceshipのNS変更](https://www.spaceship.com/en-GB/knowledgebase/connect-domain-custom-nameservers/)、[Workers Custom Domainの前提](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

| 重視すること | 選択案 |
| --- | --- |
| 管理画面・請求先をまとめる | Cloudflare Registrar。将来必要になれば他社へ移管する |
| 登録事業者と配信基盤を分け、NS変更の自由を残す | Spaceshipで取得し、当面Cloudflare DNS + Workersを使う |

上の通常 `.com` の比較ではSpaceshipが3年で$2.07安く、更新だけの差は年$0.29。今回は管理の一元化を優先し、Cloudflare Registrarを採用する。Spaceship案は将来見直す場合の比較資料として残す。

別レジストラで購入しても、Pages の apex（例: `tensei-lab.com`）を使うにはドメインを Cloudflare zone として追加し、Cloudflare ネームサーバーへ向ける必要がある。ネームサーバーを変えない場合でも、Pages の**サブドメイン**（例: `play.example.com`）なら CNAME で接続できる。[Pages の公式手順](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## 段階的な公開案

1. **限定検証（第一候補）:** Workers Static Assets を使い、`<worker>.<account-subdomain>.workers.dev` に置く。`<account-subdomain>` は URL に公開されるため、個人名ではなくサークル名由来（例: `tensei-lab`）にする。この形式と、`workers.dev` / Version URL の Access 保護は [公式仕様](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) および [Access 文書](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) を参照。Worker単位で production と Version URL を Access 保護し、関係者だけを許可する。
2. **Pages は代替案:** Pages の `プロジェクト.pages.dev` は静的公開には使えるが、preview 用 Access だけでは production の `<project>.pages.dev` や後から足す独自ドメインまで保護されない。限定公開を維持するなら、独自ドメイン側を Access で保護した上で `pages.dev` を独自ドメインへリダイレクトする等、公開された別 URL による迂回を閉じる設計にする。[Pages のカスタムドメインと `pages.dev` リダイレクト](https://developers.cloudflare.com/pages/configuration/custom-domains/#disable-access-to-pagesdev-subdomain)
3. **公開前:** 上の候補を再検索し、通常/更新/3年総額、商標、連絡先、auto-renew を確認して独自ドメインを1つ取得する。公開に切り替える際は Worker の Access を公開方針に合わせて外し、`www` や `play` を必要に応じて正規 URL に 301 リダイレクトする。通常の本番は `workers.dev` でなく独自ドメインまたは Route が推奨される。[Cloudflare の説明](https://developers.cloudflare.com/workers/configuration/routing/)
4. **将来の Stripe チップ / チャット:** 静的配布のまま秘密鍵や Stripe webhook 検証を置かない。サイト API / 掲示板 API は独自ドメイン配下の同じ Worker origin に置く。一方 Stripe webhook は外部から到達できる必要があるため、専用 `billing-hook` Worker の POST エンドポイントだけを公開し、署名検証・POST以外の拒否・本文サイズ制限を実装する。正規通知の再送を一般投稿の連投制限で捨てない。staging のサイト Worker 全体は Access で保護し、テスト用 webhook 受信口はこの例外として分離する。詳細は[開発計画](development-plan.md)を参照。ドメイン購入自体はこれらの導入を保証しない。

## URL変更時のデータ移行

ブラウザの `localStorage` は origin（scheme + host + port）単位で分かれる。したがって `*.workers.dev`（または `*.pages.dev`）から独自ドメインへ移すと、同じ利用者でも葉の記念品 JSON は自動では見えない。公開前に次を用意する。

- 旧 URL で「葉 JSON をエクスポート」、新 URL で「インポート」できる導線と短い告知を置く。
- **移行期間:** 旧 origin の全 URL をすぐ独自ドメインへリダイレクトしない。`/archive-export.html` のような専用救出ページを旧 Worker に残し、そのパスだけ redirect 対象外にしてエクスポートを可能にする。代替として、全体リダイレクトは利用者への移行期限後まで遅らせる。旧 origin の storage はリダイレクト先から直接読めない。
- **期限後:** エクスポート案内と利用期限を告知した後、旧 URL 全体を独自ドメインへ 301 リダイレクトする。Pagesを使った場合の `pages.dev` リダイレクトには [Bulk Redirect の公式手順](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/) がある。
- 将来のアカウント連携を決めるまでは、葉は記念品として端末内データであることを明記する。ゲーム間の能力継承は未決定のままにする。

## 短縮 URL の扱い

短縮 URL は告知・QRコード・長い preview URL の共有には便利だが、短縮先を知る人は誰でも開ける。認証、公開停止、決済、チャットの本人確認の代替にはならない。無料短縮サービスは運営変更・リンク失効・追跡方針の影響を受けうるため、正式公開後の主 URL は独自ドメインとし、短縮 URL は補助導線に限る。
