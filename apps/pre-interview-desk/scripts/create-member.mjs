// 最初の管理者などを作る：
//   DESK_DATABASE_URL=... node scripts/create-member.mjs <メール> <名前> <パスワード> [admin|agent] [会社]
import pg from "pg";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const [email, name, password, role = "admin", company = "foresma"] = process.argv.slice(2);
if (!email || !name || !password) { console.error("使い方: node scripts/create-member.mjs <メール> <名前> <パスワード> [admin|agent] [会社]"); process.exit(1); }
if (password.length < 10) { console.error("パスワードは10文字以上にしてください"); process.exit(1); }
const salt = randomBytes(16).toString("hex");
const hash = `scrypt$${salt}$${(await promisify(scrypt)(password, salt, 64)).toString("hex")}`;
const url = process.env.DESK_DATABASE_URL;
const local = /host=\/|localhost|127\.0\.0\.1/.test(url || "");
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(`insert into desk_members (email, name, role, company, password_hash) values (lower($1), $2, $3, $4, $5)
  on conflict ((lower(email))) do update set name = excluded.name, role = excluded.role, company = excluded.company, password_hash = excluded.password_hash, active = true`,
  [email, name, role === "agent" ? "agent" : "admin", company, hash]);
await client.end();
console.log(`登録しました：${email}（${name} / ${role}）`);
