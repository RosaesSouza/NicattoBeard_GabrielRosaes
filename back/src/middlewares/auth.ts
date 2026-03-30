import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../..", ".env") });

export interface JWTPayload {
  sub: number | string;
  role: "cliente" | "barbeiro";
  name: string;
  email: string;
  admin?: boolean;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Funcao responsavel por exigir Bearer token valido, decodificar o JWT e anexar os dados do usuario autenticado na requisicao.
export function authRequired(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Token ausente." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}

// Funcao responsavel por bloquear a rota quando o usuario autenticado nao for barbeiro administrador.
export function barberAdminRequired(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const isBarberAdmin =
    req.user?.role === "barbeiro" && req.user?.admin === true;

  if (!isBarberAdmin) {
    return res.status(403).json({
      message: "Apenas barbeiro admin pode realizar esta acao.",
    });
  }

  return next();
}

// Funcao responsavel por indicar, de forma utilitaria, se o usuario informado e um barbeiro com permissao de admin.
export function isBarberAdminUser(user?: JWTPayload): boolean {
  return user?.role === "barbeiro" && user?.admin === true;
}

// Funcao responsavel por indicar se o usuario informado e barbeiro comum (nao administrador).
export function isBarberNonAdminUser(user?: JWTPayload): boolean {
  return user?.role === "barbeiro" && user?.admin !== true;
}
