import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../bd";
import { authRequired, isBarberAdminUser, JWTPayload } from "../middlewares/auth";
import { sendServerError, isDuplicateError } from "../utils/httpErrors";

const router = Router();

const IS_PROD = process.env.NODE_ENV === "production";
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas de login. Tente novamente em 10 minutos." },
  skipSuccessfulRequests: true,
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas requisições de refresh. Tente novamente em breve." },
});

const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas de cadastro. Tente novamente em alguns minutos." },
  skipSuccessfulRequests: true,
});

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email({ message: "Email inválido." })
      .max(100, { message: "Email muito longo." })
      .optional(),
    usuario: z
      .string()
      .trim()
      .email({ message: "Email inválido." })
      .max(100, { message: "Email muito longo." })
      .optional(),
    tipo: z.enum(["cliente", "barbeiro"]).optional(),
    senha: z
      .string()
      .min(6, { message: "Senha deve ter pelo menos 6 caracteres." })
      .max(128, { message: "Senha muito longa." }),
  })
  .refine((data) => !!(data.email || data.usuario), {
    message: "Email é obrigatório.",
    path: ["email"],
  });

const registerClienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres." })
    .max(100, { message: "Nome muito longo." }),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido." })
    .max(100, { message: "Email muito longo." }),
  telefone: z
    .string()
    .trim()
    .regex(/^(\(\d{2}\)\s?\d{4,5}-\d{4}|\d{10,11})$/, {
      message: "Telefone inválido. Use o formato (11) 99999-9999.",
    })
    .optional()
    .nullable(),
  senha: z
    .string()
    .min(6, { message: "Senha deve ter pelo menos 6 caracteres." })
    .max(128, { message: "Senha muito longa." })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,128}$/, {
      message: "Senha deve ter no mínimo 6 caracteres com letra maiúscula, minúscula, número e símbolo.",
    }),
});

const profileUpdateSchema = z
  .object({
    nome: z
      .string()
      .min(2, { message: "Nome deve ter pelo menos 2 caracteres." })
      .max(100)
      .optional(),
    email: z
      .string()
      .email({ message: "Email inválido." })
      .max(100)
      .optional(),
    telefone: z.string().max(20, { message: "Telefone muito longo." }).optional().nullable(),
    senha: z
      .string()
      .min(6, { message: "Senha deve ter pelo menos 6 caracteres." })
      .max(128)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

// Funcao responsavel por validar o corpo da requisicao com Zod e interromper o fluxo com erro 422 quando os dados forem invalidos.
function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => issue.message);
      return res.status(422).json({ message: errors[0], errors });
    }
    req.body = result.data;
    next();
  };
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

// Funcao responsavel por gerar o hash SHA-256 usado para armazenar e comparar refresh tokens sem persistir o token bruto no banco.
function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

interface UserPayload {
  id: number;
  role: "cliente" | "barbeiro";
  name: string;
  email: string;
  admin?: boolean;
}

// Funcao responsavel por assinar e retornar um access token JWT com os dados de identidade e permissao do usuario.
function issueAccessToken(user: UserPayload): string {
  const secret = process.env.JWT_SECRET || "default-secret";
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
  
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      admin: !!user.admin,
    },
    secret as string,
    { expiresIn } as jwt.SignOptions
  );
}

async function issueRefreshToken(
  userId: number,
  userType: "cliente" | "barbeiro"
): Promise<string> {
  const raw = crypto.randomBytes(40).toString("hex");
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + REFRESH_MS);
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    [userId, userType, hash, expiresAt]
  );
  return raw;
}

// Rota responsavel por cadastrar cliente, validar email unico entre tabelas, emitir tokens e abrir sessao com cookie httpOnly.
router.post(
  "/register-cliente",
  registerLimiter,
  validate(registerClienteSchema),
  async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone = null, senha } = req.body;

      const [duplicateRows] = await pool.query(
        `SELECT 1 FROM clientes WHERE email = ?
         UNION ALL
         SELECT 1 FROM barbeiros WHERE email = ?
         LIMIT 1`,
        [email, email]
      );

      if ((duplicateRows as any[]).length) {
        return res.status(409).json({ message: "Email já cadastrado." });
      }

      const hash = await bcrypt.hash(senha, BCRYPT_SALT_ROUNDS);
      const [result] = await pool.query(
        `INSERT INTO clientes (nome, telefone, email, senha)
         VALUES (?, ?, ?, ?)`,
        [nome, telefone, email, hash]
      );

      const insertResult = result as any;
      const user: UserPayload = {
        id: insertResult.insertId,
        role: "cliente",
        name: nome,
        email,
        admin: false,
      };

      const accessToken = issueAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id, user.role);

      res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
      return res.status(201).json({
        accessToken,
        user,
        message: "Cadastro realizado com sucesso.",
      });
    } catch (e) {
      if (isDuplicateError(e)) {
        return res.status(409).json({ message: "Email já cadastrado." });
      }
      return sendServerError(res, e);
    }
  }
);

// Rota responsavel por autenticar cliente/barbeiro, validar senha e entregar novos tokens de acesso e refresh.
router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, usuario, senha, tipo } = req.body;
      const loginEmail = String(email || usuario).trim().toLowerCase();

      let sql = `
        SELECT id_cliente AS id, nome AS name, email, senha AS password_hash, 'cliente' AS role, FALSE AS admin
        FROM clientes
        WHERE email = ?
        UNION ALL
        SELECT id_barbeiro AS id, nome AS name, email, senha AS password_hash, 'barbeiro' AS role, admin
        FROM barbeiros
        WHERE email = ?
        LIMIT 1
      `;
      let params: any[] = [loginEmail, loginEmail];

      if (tipo === "cliente") {
        sql = `
          SELECT id_cliente AS id, nome AS name, email, senha AS password_hash, 'cliente' AS role, FALSE AS admin
          FROM clientes
          WHERE email = ?
          LIMIT 1
        `;
        params = [loginEmail];
      }

      if (tipo === "barbeiro") {
        sql = `
          SELECT id_barbeiro AS id, nome AS name, email, senha AS password_hash, 'barbeiro' AS role, admin
          FROM barbeiros
          WHERE email = ?
          LIMIT 1
        `;
        params = [loginEmail];
      }

      const [rows] = await pool.query(sql, params);
      const userRows = rows as any[];
      if (!userRows.length)
        return res.status(401).json({ message: "Credenciais inválidas." });

      const user = userRows[0];
      const ok = await bcrypt.compare(senha, user.password_hash);
      if (!ok)
        return res.status(401).json({ message: "Credenciais inválidas." });

      const accessToken = issueAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id, user.role);

      res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
      return res.json({
        accessToken,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          admin: !!user.admin,
        },
      });
    } catch (e) {
      return sendServerError(res, e);
    }
  }
);

// Rota responsavel por trocar refresh token valido por um novo par de tokens, aplicando rotacao de refresh token por seguranca.
router.post(
  "/refresh",
  refreshLimiter,
  async (req: Request, res: Response) => {
    try {
      const raw = req.cookies?.refreshToken;
      if (!raw)
        return res.status(401).json({ message: "Refresh token ausente." });

      const hash = sha256(raw);
      const [rows] = await pool.query(
        `SELECT rt.id, rt.user_id, rt.user_type, rt.expires_at,
                c.nome AS cliente_nome, c.email AS cliente_email,
                b.nome AS barbeiro_nome, b.email AS barbeiro_email, b.admin AS barbeiro_admin
         FROM refresh_tokens rt
         LEFT JOIN clientes c
           ON rt.user_type = 'cliente' AND c.id_cliente = rt.user_id
         LEFT JOIN barbeiros b
           ON rt.user_type = 'barbeiro' AND b.id_barbeiro = rt.user_id
         WHERE rt.token_hash = ? LIMIT 1`,
        [hash]
      );

      const tokenRows = rows as any[];
      if (
        !tokenRows.length ||
        new Date(tokenRows[0].expires_at) < new Date()
      ) {
        res.clearCookie("refreshToken", COOKIE_OPTS);
        return res
          .status(401)
          .json({ message: "Refresh token inválido ou expirado." });
      }

      const row = tokenRows[0];
      const user: UserPayload = {
        id: row.user_id,
        role: row.user_type,
        name:
          row.user_type === "cliente" ? row.cliente_nome : row.barbeiro_nome,
        email:
          row.user_type === "cliente" ? row.cliente_email : row.barbeiro_email,
        admin:
          row.user_type === "barbeiro" ? !!row.barbeiro_admin : false,
      };

      if (!user.name || !user.email) {
        res.clearCookie("refreshToken", COOKIE_OPTS);
        return res
          .status(401)
          .json({ message: "Refresh token inválido ou expirado." });
      }

      await pool.query("DELETE FROM refresh_tokens WHERE id = ?", [row.id]);
      const accessToken = issueAccessToken(user);
      const newRefreshToken = await issueRefreshToken(user.id, user.role);

      res.cookie("refreshToken", newRefreshToken, COOKIE_OPTS);
      return res.json({ accessToken, user });
    } catch (e) {
      return sendServerError(res, e);
    }
  }
);

// Rota responsavel por encerrar a sessao removendo o refresh token do banco e limpando o cookie no navegador.
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      const hash = sha256(raw);
      await pool.query(
        "DELETE FROM refresh_tokens WHERE token_hash = ?",
        [hash]
      );
    }
    res.clearCookie("refreshToken", COOKIE_OPTS);
    return res.json({ message: "Logout realizado." });
  } catch (e) {
    return sendServerError(res, e);
  }
});

// Rota responsavel por retornar o perfil do usuario autenticado com base no papel presente no token JWT.
router.get("/me", authRequired, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const role = req.user?.role;

    if (!userId || (role !== "cliente" && role !== "barbeiro")) {
      return res
        .status(401)
        .json({ message: "Token inválido ou expirado." });
    }

    const sql =
      role === "cliente"
        ? `SELECT id_cliente AS id, nome AS name, email, telefone, 'cliente' AS role, FALSE AS admin
           FROM clientes
           WHERE id_cliente = ?
           LIMIT 1`
        : `SELECT id_barbeiro AS id, nome AS name, email, telefone, 'barbeiro' AS role, admin
           FROM barbeiros
           WHERE id_barbeiro = ?
           LIMIT 1`;

    const [rows] = await pool.query(sql, [userId]);
    const userRows = rows as any[];

    if (!userRows.length) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const user = userRows[0];
    return res.json({
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        telefone: user.telefone,
        admin: !!user.admin,
      },
    });
  } catch (e) {
    return sendServerError(res, e);
  }
});

// Rota responsavel por atualizar perfil do usuario autenticado, incluindo troca opcional de senha e reemissao do access token.
router.put(
  "/me",
  authRequired,
  validate(profileUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.user?.sub);
      const role = req.user?.role;

      if (!userId || (role !== "cliente" && role !== "barbeiro")) {
        return res
          .status(401)
          .json({ message: "Token inválido ou expirado." });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (req.body.nome !== undefined) {
        updates.push("nome = ?");
        params.push(req.body.nome);
      }

      if (req.body.email !== undefined) {
        updates.push("email = ?");
        params.push(req.body.email);
      }

      if (req.body.telefone !== undefined) {
        updates.push("telefone = ?");
        params.push(req.body.telefone || null);
      }

      if (req.body.senha !== undefined) {
        const hash = await bcrypt.hash(req.body.senha, BCRYPT_SALT_ROUNDS);
        updates.push("senha = ?");
        params.push(hash);
      }

      if (!updates.length) {
        return res
          .status(422)
          .json({ message: "Informe ao menos um campo para atualizar." });
      }

      const table = role === "cliente" ? "clientes" : "barbeiros";
      const idColumn = role === "cliente" ? "id_cliente" : "id_barbeiro";

      params.push(userId);

      await pool.query(
        `UPDATE ${table}
         SET ${updates.join(", ")}
         WHERE ${idColumn} = ?`,
        params
      );

      const selectSql =
        role === "cliente"
          ? `SELECT id_cliente AS id, nome AS name, email, telefone, 'cliente' AS role, FALSE AS admin
             FROM clientes
             WHERE id_cliente = ?
             LIMIT 1`
          : `SELECT id_barbeiro AS id, nome AS name, email, telefone, 'barbeiro' AS role, admin
             FROM barbeiros
             WHERE id_barbeiro = ?
             LIMIT 1`;

      const [rows] = await pool.query(selectSql, [userId]);
      const userRows = rows as any[];
      if (!userRows.length) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const user = userRows[0];
      const accessToken = issueAccessToken(user);

      return res.json({
        message: "Dados atualizados com sucesso.",
        accessToken,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          telefone: user.telefone,
          admin: !!user.admin,
        },
      });
    } catch (e) {
      if (isDuplicateError(e)) {
        return res.status(409).json({ message: "Email já cadastrado." });
      }

      return sendServerError(res, e);
    }
  }
);

export default router;
