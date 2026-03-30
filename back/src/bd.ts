import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const { Pool } = pg;

const nativePool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  max: 10,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

type InsertResult = {
  affectedRows: number;
  insertId?: string | number;
  rows: any[];
};

type QueryResult = any[];

// Funcao responsavel por converter placeholders no formato '?' para '$1', '$2'... exigidos pelo driver do PostgreSQL.
function toPgParams(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

const insertPkByTable: Record<string, string> = {
  clientes: "id_cliente",
  barbeiros: "id_barbeiro",
  especialidade: "id_especialidade",
  servicos: "id_servico",
  reservas: "id_reserva",
  refresh_tokens: "id",
};

// Funcao responsavel por adicionar automaticamente RETURNING na instrucao INSERT quando a tabela possui chave primaria conhecida.
function withAutoReturning(
  sql: string
): { sql: string; insertIdColumn: string | null } {
  const normalized = sql.trim();
  if (
    !/^insert\s+into\s+/i.test(normalized) ||
    /\breturning\b/i.test(normalized)
  ) {
    return { sql, insertIdColumn: null };
  }

  const tableMatch = normalized.match(
    /^insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/i
  );
  const table = tableMatch?.[1]?.toLowerCase();
  const insertIdColumn = table ? insertPkByTable[table] : null;

  if (!insertIdColumn) {
    return { sql, insertIdColumn: null };
  }

  return {
    sql: `${normalized} RETURNING ${insertIdColumn}`,
    insertIdColumn,
  };
}

export const pool = {
  async query(sql: string, params: any[] = []): Promise<[InsertResult | QueryResult]> {
    const { sql: insertAwareSql, insertIdColumn } = withAutoReturning(sql);
    const translatedSql = toPgParams(insertAwareSql);
    const result = await nativePool.query(translatedSql, params);

    if (/^\s*(select|with)\b/i.test(translatedSql)) {
      return [result.rows];
    }

    return [
      {
        affectedRows: result.rowCount ?? 0,
        insertId: insertIdColumn && result.rows[0]
          ? result.rows[0][insertIdColumn]
          : undefined,
        rows: result.rows,
      },
    ];
  },

  async end() {
    await nativePool.end();
  },
};
