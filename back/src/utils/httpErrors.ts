import { Response } from "express";

// Funcao responsavel por identificar erros tipicos de indisponibilidade de banco para permitir resposta HTTP adequada.
function isDatabaseUnavailable(err: unknown): boolean {
  if (!err) return false;

  const error = err as any;

  if (
    error.code === "ECONNREFUSED" ||
    error.code === "ENOTFOUND" ||
    error.code === "ETIMEDOUT"
  ) {
    return true;
  }

  if (
    Array.isArray(error.errors) &&
    error.errors.some((inner: any) => inner?.code === "ECONNREFUSED")
  ) {
    return true;
  }

  return false;
}

// Funcao responsavel por centralizar o tratamento de erro interno e retornar 503 para falha de banco ou 500 para erro generico.
export function sendServerError(res: Response, err: unknown): Response {
  console.error(err);

  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({ message: "Banco de dados indisponivel." });
  }

  return res.status(500).json({ message: "Erro no servidor." });
}

// Funcao responsavel por reconhecer violacao de unicidade (ex.: email duplicado) a partir do erro do banco.
export function isDuplicateError(err: unknown): boolean {
  const error = err as any;
  return error?.code === "23505" || error?.constraint?.includes("unique");
}

// Funcao responsavel por reconhecer erro de chave estrangeira invalida retornado pelo PostgreSQL.
export function isForeignKeyError(err: unknown): boolean {
  const error = err as any;
  return error?.code === "23503";
}
