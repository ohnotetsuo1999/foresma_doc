# プレ面談予約デスク（アプリ）

架電代行（スイッチ社）が1次の電話で話し、そのまま foresma の IS とのプレ面談を **LREACH Hub の `interview_bookings`** に予約するためのWebアプリです。

- 電話番号でユーザーを特定 → 登録名で本人確認 → 空き枠を提案（おすすめ／カレンダー）して5分仮押さえ → Hubに登録
- 登録後、HubのIS自動割当・カレンダー・面談URL・確定メッセージが済んだかを約90秒追跡して表示
- トスアップ（送客FMT）は予約と同時でも、あとから「トスアップ待ち」でも入力可。送客FMTの貼り付け読み込みあり
- 予約に至らなかった結果・通話状況・メモ・再電話リストを全員で共有
- **Googleログイン**（招待制：管理者がメンバー登録したメールアドレスだけ）。パスワードログインも予備として使える（`PASSWORD_LOGIN=0` で無効化）
- 管理者によるメンバー追加・無効化・パスワード再発行

仕様の図解：`docs/by-user/oonotetsuo/2026-10-14/プレ面談予約デスク_仕様図.html`

## しくみ

| 置き場所 | 用途 | 接続 |
|---|---|---|
| LREACH Hub（lreach_hub） | ユーザー検索・空き枠（`slot_capacity_logs`）・ISの優先度・**予約の登録（`interview_bookings`）**・処理状況の確認 | `HUB_DATABASE_URL` |
| ohno_project | トスアップと予約の控え・架電結果・仮押さえ・設定・メンバー（`desk_*`）、過去のトスアップ（`tossup_info`） | `DESK_DATABASE_URL` |

- データベースにはサーバー（Next.js のAPI）だけがつなぎます。ブラウザに接続情報やSQLは渡しません。
- 予約は件名「【電話面談】◯◯様　出会えるエージェント」、フォーム・リマインド種別（電話8／オンライン9）、15分、アポ取得者「スイッチ」、タグ `架電代行_スイッチ` で登録します。IS担当は空欄で登録し、Hubの自動割当に任せます。
- 満席はHubのトリガー（`enforce_interview_booking_slot_capacity`）が最終判定し、拒否された場合は画面で別の枠を選びます。

## セットアップ

1. **共有テーブルを作る**：ohno_project の SQL Editor で `sql/desk_tables.sql` を実行
2. **接続文字列を用意**：Supabase の各プロジェクト → Project Settings → Database → Connection string（Transaction pooler, 6543）
   - Hub側のユーザーには `interview_bookings` への INSERT 権限が必要です（読み取り専用ユーザーでは登録できません）
3. **Googleログインの準備**（Google Cloud Console）
   - 「APIとサービス」→「OAuth同意画面」：ユーザーの種類は **外部**（スイッチ社のGoogleアカウントも使うため）。アプリ名・サポートメールを入れて公開
   - 「認証情報」→「OAuthクライアントID」→ 種類「ウェブアプリケーション」
   - 承認済みのリダイレクトURI：`https://（公開URL）/api/auth/google/callback`（ローカルは `http://localhost:3100/api/auth/google/callback`）
   - 表示されたクライアントIDとシークレットを環境変数へ
4. **環境変数**：`.env.example` を見て `HUB_DATABASE_URL` / `DESK_DATABASE_URL` / `SESSION_SECRET`（`openssl rand -hex 32`）/ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `APP_BASE_URL` を設定
   - 本番前の確認だけしたいときは `HUB_WRITE_DISABLED=1`（Hubに書き込まず「Hub未登録」で保存）
5. **最初の管理者を作る**（Googleログインだけならパスワードは `-`）
   ```
   npm install
   DESK_DATABASE_URL=... npm run create-member -- ohnotetsuo@foresma.jp "foresma 大野" - admin foresma
   ```
6. **起動**：`npm run dev`（http://localhost:3100）。Googleでログインし、右上「メンバー管理」からスイッチ社のメンバーをメールアドレスで追加（そのGoogleアカウントでログインできるようになります）

## Vercel に公開する

1. Vercel で GitHub リポジトリ `ohnotetsuo1999/foresma_doc` をインポート
2. **Root Directory** を `apps/pre-interview-desk` に設定（Framework は Next.js を自動検出）
3. Environment Variables に `HUB_DATABASE_URL` / `DESK_DATABASE_URL` / `SESSION_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `APP_BASE_URL`（例：https://pre-interview-desk.vercel.app）を登録
4. Google Cloud Console のリダイレクトURIに `（APP_BASE_URL）/api/auth/google/callback` を追加
5. デプロイ後、Googleでログインしてメンバーを追加

## 本番での最初の確認

テスト用のユーザーで1件予約し、完了画面の「Hubでの処理状況」で次がすべて「済」になるかを見てください。

- IS担当の自動割当
- ISのGoogleカレンダーへの登録
- （オンラインのとき）面談URLの発行
- LINEで確定メッセージを送信

「未」のまま残る項目があれば、その処理がHubアプリ側の予約フローでしか動いていないということなので、Hubの予約APIを呼ぶ形に切り替えます。

## テスト

`test/fixtures_hub.sql`（Hubの最小コピー・架空データ）と `test/fixtures_desk.sql` をローカルの Postgres に入れ、`test/e2e.cjs`（Playwright）でログイン〜予約〜トスアップ〜満席〜再電話〜権限まで通しで確認しています。
