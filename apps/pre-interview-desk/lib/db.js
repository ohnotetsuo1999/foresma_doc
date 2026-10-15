import pg from "pg";

// 接続はサーバー側だけで持つ。ブラウザには接続文字列もSQLも渡さない
const pools = globalThis.__deskPools || (globalThis.__deskPools = {});

function pool(name) {
  const url = process.env[name];
  if (!url) throw Object.assign(new Error(`${name} が設定されていません`), { status: 500 });
  if (!pools[name]) {
    const local = /host=\/|localhost|127\.0\.0\.1/.test(url) || process.env.DB_SSL === "0";
    pools[name] = new pg.Pool({ connectionString: url, max: 3, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return pools[name];
}

export const hub = (text, params = []) => pool("HUB_DATABASE_URL").query(text, params).then(r => r.rows);
export const desk = (text, params = []) => pool("DESK_DATABASE_URL").query(text, params).then(r => r.rows);
