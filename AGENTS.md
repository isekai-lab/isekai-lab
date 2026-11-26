# tensei-lab

- サークル名: 転生魔法研究所。リポジトリの設置先は `~/git/isekai-lab`。
- 短編ゲームの試作は `3min-rpg/`、HD-2D実験は `hd-2d/`。概要・実行方法は各READMEとルート `README.md`。
- 各作品はTypeScriptのES modulesで開発し、配布時は外部通信不要の単体HTMLにする。
- 共通の見た目、葉、描画、素材は `3min-rpg/common/`。固有のルールは各 `gameN/src/`。
- マウス・タッチ操作を主にし、スマホとPCで確認する。
- 共通アセットは既存作品から流用せず、出自・ライセンスを記録する。
- `npm run build` と `npm test` を実行する。型検査環境があれば `npm run typecheck`。
- 公開物に実名・個人アカウント・端末の絶対パスを入れない。
- 初期の試作では記憶の葉は記念品。ゲームをまたぐ能力継承は未決定。
- 公式メールアドレス: isekai.lab.games@gmail.com
  - 各種アカウントに利用
