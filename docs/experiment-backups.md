# 実験データのバックアップと復元

制作は内蔵ディスクで続け、完了済みの実験を実験単位で外部ストレージにコピーする。接続できない間は `.local/experiment-backup/queue/` に登録が残る。コピー後も制作中のレポートとビューアは元のパスから開ける。

## 日常の運用

- 背景反復と `art-rsi` は、正常に完了した記録を確認し、完了から 1 時間経った実験を定期実行時に登録する。早く保存したい場合は、書き込みが終わった時点で手動登録できる。
- キャラクターラボ、手動実験、旧形式の実験は、担当者が完了を確認して実験ディレクトリを登録する。記録と出力をまとめ、再現に必要なパッチ、入力の出典・ハッシュ、使用したコマンドも実験内に保存する。新規の大きな成果物の出力先には `.local/artifacts/<実験ID>/` を使える。
- `status` の `complete` は、以前の実行で検証を終えた記録。原本の整理前には `verify` で接続中の保存先を読み直す。毎月、代表 1 件の復元と内蔵ディスクの空き容量を確認する。

```sh
npm run backup:experiments -- enqueue .local/artifacts/experiment-001
npm run backup:experiments -- status
npm run backup:experiments -- run
```

保存先には実験のリポジトリ相対パスを保持する。`isekai-lab/experiments/<相対パス>/` の中に `payload.tar`、ファイル一覧とハッシュを含む `manifest.json`、`SHA256SUMS` ができる。既に保存した実験を修正する場合は、別の実験 ID を付けて登録する。

## Mac で定期実行を設定する

Python 3.11.9 以降を使う。リムーバブルディスクを接続し、利用するマウントポイントを `ISEKAI_BACKUP_VOLUME` に設定する。標準のボリューム名は `HOME`。設定時だけ、初期化と LaunchAgent の登録を行う。初期化はマウント済みのボリュームに印を付ける。定期ジョブはその印を確認してから保存する。

```sh
npm run backup:experiments -- init-volume
python3 -B tools/install_experiment_backup.py
launchctl print "gui/$(id -u)/com.isekai-lab.experiment-backup"
```

ログイン中は毎日 00:20、06:20、12:20、18:20 と、ファイルシステムがマウントされた時に起動する。対象のディスクが外れていれば、次の起動まで待つ。実行ログは `.local/experiment-backup/launchd.log` と `launchd.err.log` に記録する。保存先を変更する場合は、`launchctl bootout` でこのジョブを解除し、`~/Library/LaunchAgents/` 下の `com.isekai-lab.experiment-backup.plist` を取り除いてから、変更後の設定で登録し直す。[Apple の LaunchAgent ガイド](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)

## 検証と復元

外部ストレージを接続して実物を検証する。復元先は親ディレクトリが存在する新規パスを指定する。成功すると、そこに元のリポジトリ相対パスで実験が展開される。

```sh
npm run backup:experiments -- verify hd-2d/art-rsi/runs/loop-04
npm run backup:experiments -- restore hd-2d/art-rsi/runs/loop-04 --to /tmp/isekai-loop-04-restore
```

元の場所を整理する場合は、先にレポートやスコアカードからのリンク、反復 CLI の状態確認、次の run の入力を調べる。Git 側に採否・代表画像と復元用の相対パスを残し、再生成できない原本は別媒体にも保全する。バックアップジョブはコピーと検証を担当し、原本の整理は対象を決めて行う。

## Git 容量の点検

`git count-objects -vH` でローカルの容量を確認する。`git prune-packed -n` はパックと重複するルーズオブジェクトの整理候補を出す。Codex の作業チェックポイントを含む `.git` をさらに小さくする場合は、進行中のセッションを終え、作業ツリーと旧 checkout の復元を確認した上で、`main` の履歴を持つ別の作業コピーへ切り替える。実験バックアップは Git のローカル履歴と切り離して運用する。[Git の重複整理](https://git-scm.com/docs/git-prune-packed)
