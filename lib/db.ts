import mysql from "mysql2/promise";

/**
 * MySQL-Verbindungspool (lazy – wird erst beim ersten Query erstellt,
 * damit `next build` ohne Datenbank durchläuft).
 *
 * Zugangsdaten kommen ausschließlich aus Umgebungsvariablen (.env.local
 * bzw. .env auf dem Server) – niemals im Code/Repo!
 */
let pool: mysql.Pool | null = null;

export function db(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      // DATETIME als String liefern (kein Zeitzonen-Umrechnen)
      dateStrings: true,
    });
  }
  return pool;
}

type SqlParam = string | number | boolean | null;

/** SELECT-Helfer: liefert Zeilen als Objekt-Array. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  const [rows] = await db().execute(sql, params);
  return rows as T[];
}

/** INSERT/UPDATE/DELETE-Helfer: liefert affectedRows. */
export async function exec(sql: string, params: SqlParam[] = []): Promise<number> {
  const [result] = await db().execute(sql, params);
  return (result as mysql.ResultSetHeader).affectedRows ?? 0;
}
