-- テスト用：ohno_project 側の tossup_info（Slackトスアップの取込）の最小コピー
create table tossup_info (slack_ts text, channel_id text, posted_at timestamptz, user_id text, is_name text, age int, desired_area text, home_pref text, overall_grade text, intro text, permalink text);
insert into tossup_info values ('1','C0',now() - interval '30 days','33333333-3333-3333-3333-333333333333','テストIS 青木',27,'東京都','東京都','B','（架空）以前のトスアップの紹介文です。','https://example.com/slack');
