import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../bd";
import {
  authRequired,
  barberAdminRequired,
  JWTPayload,
  isBarberAdminUser as isBarberAdminUserFn,
  isBarberNonAdminUser as isBarberNonAdminUserFn,
} from "../middlewares/auth";
import { sendServerError, isDuplicateError, isForeignKeyError } from "../utils/httpErrors";

const router = Router();
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

router.use(authRequired);

const telefoneSchema = z
  .string()
  .trim()
  .regex(/^(\(\d{2}\)\s?\d{4,5}-\d{4}|\d{10,11})$/, {
    message: "Telefone invalido. Use o formato (11) 99999-9999.",
  });

const senhaForteSchema = z
  .string()
  .min(6)
  .max(128)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,128}$/, {
    message: "Senha deve ter no minimo 6 caracteres com letra maiuscula, minuscula, numero e simbolo.",
  });

const nascimentoSchema = z
  .string()
  .date()
  .refine((value) => {
    const birth = new Date(`${value}T00:00:00`);
    const today = new Date();
    const minDate = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    return birth <= minDate;
  }, {
    message: "Data de nascimento invalida. O barbeiro deve ter no minimo 18 anos.",
  });

const contratacaoSchema = z
  .string()
  .date()
  .refine((value) => {
    const hiring = new Date(`${value}T00:00:00`);
    const today = new Date();
    const todayNoTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    return hiring <= todayNoTime;
  }, {
    message: "Data de contratacao invalida. Nao pode ser futura.",
  });

const clienteSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  telefone: telefoneSchema.optional().nullable(),
  email: z.string().trim().email().max(100),
  senha: senhaForteSchema,
});

const clienteUpdateSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    telefone: telefoneSchema.optional().nullable(),
    email: z.string().trim().email().max(100).optional(),
    senha: senhaForteSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

const barbeiroSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  telefone: telefoneSchema.optional().nullable(),
  email: z.string().trim().email().max(100),
  senha: senhaForteSchema,
  nascimento: nascimentoSchema.optional().nullable(),
  contratacao: contratacaoSchema.optional().nullable(),
  admin: z.boolean().optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const barbeiroUpdateSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    telefone: telefoneSchema.optional().nullable(),
    email: z.string().trim().email().max(100).optional(),
    senha: senhaForteSchema.optional(),
    nascimento: nascimentoSchema.optional().nullable(),
    contratacao: contratacaoSchema.optional().nullable(),
    admin: z.boolean().optional(),
    cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

const especialidadeSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(1000).optional().nullable(),
});

const servicoSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(1000).optional().nullable(),
  valor: z.coerce.number().positive(),
  tempo_medio: z.coerce.number().int().min(1).max(4),
  id_especialidade: z.coerce.number().int().positive(),
});

const servicoUpdateSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    descricao: z.string().trim().max(1000).optional().nullable(),
    valor: z.coerce.number().positive().optional(),
    tempo_medio: z.coerce.number().int().min(1).max(4).optional(),
    id_especialidade: z.coerce.number().int().positive().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

const barbeiroEspecialidadeSchema = z.object({
  id_barbeiro: z.coerce.number().int().positive(),
  id_especialidade: z.coerce.number().int().positive(),
});

const horarioSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: "horario_inicial deve estar no formato HH:MM ou HH:MM:SS",
  })
  .refine((value) => {
    const [hours] = value.split(":");
    const hour = parseInt(hours, 10);
    return hour >= 8 && hour < 18;
  }, {
    message: "Agendamentos só são permitidos entre 08:00 e 18:00",
  });

const reservaSchema = z.object({
  id_barbeiro: z.coerce.number().int().positive(),
  id_cliente: z.coerce.number().int().positive(),
  id_servico: z.coerce.number().int().positive(),
  data: z.string().date(),
  horario_inicial: horarioSchema,
});

const reservaUpdateSchema = z
  .object({
    id_barbeiro: z.coerce.number().int().positive().optional(),
    id_cliente: z.coerce.number().int().positive().optional(),
    id_servico: z.coerce.number().int().positive().optional(),
    data: z.string().date().optional(),
    horario_inicial: horarioSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

// Funcao responsavel por validar o payload das rotas com Zod e devolver 422 com mensagens detalhadas quando houver erro.
function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => issue.message);
      return res.status(422).json({ message: errors[0], errors });
    }
    req.body = result.data;
    return next();
  };
}

// Funcao responsavel por encapsular a regra de permissao para barbeiro administrador usando o helper do middleware.
function isBarberAdminUser(user?: JWTPayload): boolean {
  return isBarberAdminUserFn(user);
}

// Funcao responsavel por encapsular a regra de permissao para barbeiro nao administrador usando o helper do middleware.
function isBarberNonAdminUser(user?: JWTPayload): boolean {
  return isBarberNonAdminUserFn(user);
}

router.get("/especialidades", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_especialidade, nome, descricao
       FROM especialidade
       ORDER BY nome ASC`
    );

    return res.json({ especialidades: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/barbeiros", async (req: Request, res: Response) => {
  try {
    if (isBarberAdminUser(req.user)) {
      const [rows] = await pool.query(
        `SELECT id_barbeiro, nome, email, telefone,
                TO_CHAR(nascimento, 'YYYY-MM-DD') AS nascimento,
                TO_CHAR(contratacao, 'YYYY-MM-DD') AS contratacao,
                admin, cor
         FROM barbeiros
         ORDER BY nome ASC`
      );

      return res.json({ barbeiros: rows });
    }

    const [rows] = await pool.query(
      `SELECT id_barbeiro, nome, cor
       FROM barbeiros
       ORDER BY nome ASC`
    );

    return res.json({ barbeiros: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/clientes", async (req: Request, res: Response) => {
  try {
    if (!isBarberAdminUser(req.user)) {
      return res
        .status(403)
        .json({ message: "Apenas barbeiro admin pode acessar clientes." });
    }

    const [rows] = await pool.query(
      `SELECT id_cliente, nome, telefone, email
       FROM clientes
       ORDER BY nome ASC`
    );

    return res.json({ clientes: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/servicos", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id_servico, s.nome, s.descricao, s.valor, s.tempo_medio, s.id_especialidade, e.nome AS especialidade_nome
       FROM servicos s
       LEFT JOIN especialidade e ON e.id_especialidade = s.id_especialidade
       ORDER BY s.nome ASC`
    );

    return res.json({ servicos: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/barbeiro-especialidades", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        be.id_barbeiro,
        be.id_especialidade,
        b.nome AS barbeiro_nome,
        e.nome AS especialidade_nome
       FROM barbeiro_especialidade be
       INNER JOIN barbeiros b ON b.id_barbeiro = be.id_barbeiro
       INNER JOIN especialidade e ON e.id_especialidade = be.id_especialidade
       ORDER BY b.nome ASC, e.nome ASC`
    );

    return res.json({ barbeiro_especialidades: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/barbeiros-especialidades", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        be.id_barbeiro,
        be.id_especialidade,
        b.nome AS barbeiro_nome,
        e.nome AS especialidade_nome
       FROM barbeiro_especialidade be
       INNER JOIN barbeiros b ON b.id_barbeiro = be.id_barbeiro
       INNER JOIN especialidade e ON e.id_especialidade = be.id_especialidade
       ORDER BY b.nome ASC, e.nome ASC`
    );

    return res.json({ barbeiro_especialidades: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get("/horarios-disponiveis", async (req: Request, res: Response) => {
  try {
    const idBarbeiro = Number(req.query.id_barbeiro);
    const { data } = req.query;

    if (!Number.isInteger(idBarbeiro) || idBarbeiro <= 0) {
      return res.status(422).json({ message: "id_barbeiro invalido." });
    }

    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(422).json({ message: "data deve estar no formato YYYY-MM-DD." });
    }

    const [rows] = await pool.query(
      `SELECT
        r.id_reserva,
        TO_CHAR(r.horario_inicial, 'HH24:MI:SS') AS horario_inicial,
        s.tempo_medio AS tempo_medio
       FROM reservas r
       INNER JOIN servicos s ON s.id_servico = r.id_servico
       WHERE r.id_barbeiro = ? AND r.data = ? AND r.cancelado = FALSE
       ORDER BY r.horario_inicial ASC`,
      [idBarbeiro, data]
    );

    return res.json({ reservas: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post("/clientes", validate(clienteSchema), async (req: Request, res: Response) => {
  try {
    if (!isBarberAdminUser(req.user)) {
      return res
        .status(403)
        .json({ message: "Apenas barbeiro admin pode criar clientes." });
    }

    const { nome, telefone = null, email, senha } = req.body;
    const hash = await bcrypt.hash(senha, BCRYPT_SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO clientes (nome, telefone, email, senha)
       VALUES (?, ?, ?, ?)`,
      [nome, telefone, email, hash]
    );

    const insertResult = result as any;
    return res.status(201).json({
      message: "Cliente criado com sucesso.",
      id_cliente: insertResult.insertId,
    });
  } catch (err) {
    if (isDuplicateError(err)) {
      return res.status(409).json({ message: "Email ja cadastrado." });
    }

    return sendServerError(res, err);
  }
});

router.delete("/clientes/:id", barberAdminRequired, async (req: Request, res: Response) => {
  try {
    const idCliente = Number(req.params.id);
    if (!Number.isInteger(idCliente) || idCliente <= 0) {
      return res.status(422).json({ message: "Id de cliente invalido." });
    }

    const [result] = await pool.query(
      `DELETE FROM clientes WHERE id_cliente = ?`,
      [idCliente]
    );

    const deleteResult = result as any;
    if (!deleteResult.affectedRows) {
      return res.status(404).json({ message: "Cliente nao encontrado." });
    }

    return res.json({ message: "Cliente excluido com sucesso." });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.put("/clientes/:id", validate(clienteUpdateSchema), async (req: Request, res: Response) => {
  try {
    if (!isBarberAdminUser(req.user)) {
      return res
        .status(403)
        .json({ message: "Apenas barbeiro admin pode atualizar clientes." });
    }

    const idCliente = Number(req.params.id);
    if (!Number.isInteger(idCliente) || idCliente <= 0) {
      return res.status(422).json({ message: "Id de cliente invalido." });
    }

    const [foundRows] = await pool.query(
      `SELECT id_cliente, nome, telefone, email, senha
       FROM clientes
       WHERE id_cliente = ?
       LIMIT 1`,
      [idCliente]
    );

    const clients = foundRows as any[];
    if (!clients.length) {
      return res.status(404).json({ message: "Cliente nao encontrado." });
    }

    const current = clients[0];
    let senhaHash = current.senha;
    if (req.body.senha) {
      senhaHash = await bcrypt.hash(req.body.senha, BCRYPT_SALT_ROUNDS);
    }

    const next = {
      nome: req.body.nome ?? current.nome,
      telefone: req.body.telefone ?? current.telefone,
      email: req.body.email ?? current.email,
      senha: senhaHash,
    };

    await pool.query(
      `UPDATE clientes
       SET nome = ?,
           telefone = ?,
           email = ?,
           senha = ?
       WHERE id_cliente = ?`,
      [next.nome, next.telefone, next.email, next.senha, idCliente]
    );

    return res.json({ message: "Cliente atualizado com sucesso." });
  } catch (err) {
    if (isDuplicateError(err)) {
      return res.status(409).json({ message: "Email ja cadastrado." });
    }

    return sendServerError(res, err);
  }
});

router.post("/barbeiros", barberAdminRequired, validate(barbeiroSchema), async (req: Request, res: Response) => {
  try {
    const {
      nome,
      telefone = null,
      email,
      senha,
      nascimento = null,
      contratacao = null,
      admin = false,
      cor = "#1e88e5",
    } = req.body;

    const hash = await bcrypt.hash(senha, BCRYPT_SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO barbeiros (nome, telefone, email, senha, nascimento, contratacao, admin, cor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, telefone, email, hash, nascimento, contratacao, admin, cor]
    );

    const insertResult = result as any;
    return res.status(201).json({
      message: "Barbeiro criado com sucesso.",
      id_barbeiro: insertResult.insertId,
    });
  } catch (err) {
    if (isDuplicateError(err)) {
      return res.status(409).json({ message: "Email ja cadastrado." });
    }

    return sendServerError(res, err);
  }
});

router.put("/barbeiros/:id", barberAdminRequired, validate(barbeiroUpdateSchema), async (req: Request, res: Response) => {
  try {
    const idBarbeiro = Number(req.params.id);
    if (!Number.isInteger(idBarbeiro) || idBarbeiro <= 0) {
      return res.status(422).json({ message: "Id de barbeiro invalido." });
    }

    const [foundRows] = await pool.query(
      `SELECT id_barbeiro, nome, telefone, email, senha, nascimento, contratacao, admin, cor
       FROM barbeiros
       WHERE id_barbeiro = ?
       LIMIT 1`,
      [idBarbeiro]
    );

    const barbers = foundRows as any[];
    if (!barbers.length) {
      return res.status(404).json({ message: "Barbeiro nao encontrado." });
    }

    const current = barbers[0];
    let senhaHash = current.senha;
    if (req.body.senha) {
      senhaHash = await bcrypt.hash(req.body.senha, BCRYPT_SALT_ROUNDS);
    }

    const next = {
      nome: req.body.nome ?? current.nome,
      telefone: req.body.telefone ?? current.telefone,
      email: req.body.email ?? current.email,
      senha: senhaHash,
      nascimento: req.body.nascimento ?? current.nascimento,
      contratacao: req.body.contratacao ?? current.contratacao,
      admin: req.body.admin ?? current.admin,
      cor: req.body.cor ?? current.cor,
    };

    await pool.query(
      `UPDATE barbeiros
       SET nome = ?,
           telefone = ?,
           email = ?,
           senha = ?,
           nascimento = ?,
           contratacao = ?,
           admin = ?,
           cor = ?
       WHERE id_barbeiro = ?`,
      [
        next.nome,
        next.telefone,
        next.email,
        next.senha,
        next.nascimento,
        next.contratacao,
        next.admin,
        next.cor,
        idBarbeiro,
      ]
    );

    return res.json({ message: "Barbeiro atualizado com sucesso." });
  } catch (err) {
    if (isDuplicateError(err)) {
      return res.status(409).json({ message: "Email ja cadastrado." });
    }

    return sendServerError(res, err);
  }
});

router.delete("/barbeiros/:id", barberAdminRequired, async (req: Request, res: Response) => {
  try {
    const idBarbeiro = Number(req.params.id);
    if (!Number.isInteger(idBarbeiro) || idBarbeiro <= 0) {
      return res.status(422).json({ message: "Id de barbeiro invalido." });
    }

    const [result] = await pool.query(
      `DELETE FROM barbeiros WHERE id_barbeiro = ?`,
      [idBarbeiro]
    );

    const deleteResult = result as any;
    if (!deleteResult.affectedRows) {
      return res.status(404).json({ message: "Barbeiro nao encontrado." });
    }

    return res.json({ message: "Barbeiro excluido com sucesso." });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post("/especialidades", barberAdminRequired, validate(especialidadeSchema), async (req: Request, res: Response) => {
  try {
    const { nome, descricao = null } = req.body;

    const [duplicateRows] = await pool.query(
      `SELECT id_especialidade
       FROM especialidade
       WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?))
       LIMIT 1`,
      [nome]
    );

    const dups = duplicateRows as any[];
    if (dups.length) {
      return res.status(409).json({ message: "Especialidade ja cadastrada." });
    }

    const [result] = await pool.query(
      `INSERT INTO especialidade (nome, descricao)
       VALUES (?, ?)`,
      [nome, descricao]
    );

    const insertResult = result as any;
    return res.status(201).json({
      message: "Especialidade criada com sucesso.",
      id_especialidade: insertResult.insertId,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.delete("/especialidades/:id", barberAdminRequired, async (req: Request, res: Response) => {
  try {
    const idEspecialidade = Number(req.params.id);
    if (!Number.isInteger(idEspecialidade) || idEspecialidade <= 0) {
      return res.status(422).json({ message: "Id de especialidade invalido." });
    }

    const [result] = await pool.query(
      `DELETE FROM especialidade WHERE id_especialidade = ?`,
      [idEspecialidade]
    );

    const deleteResult = result as any;
    if (!deleteResult.affectedRows) {
      return res.status(404).json({ message: "Especialidade nao encontrada." });
    }

    return res.json({ message: "Especialidade excluida com sucesso." });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post("/servicos", barberAdminRequired, validate(servicoSchema), async (req: Request, res: Response) => {
  try {
    const {
      nome,
      descricao = null,
      valor,
      tempo_medio,
      id_especialidade,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO servicos (nome, descricao, valor, tempo_medio, id_especialidade)
       VALUES (?, ?, ?, ?, ?)`,
      [nome, descricao, valor, tempo_medio, id_especialidade]
    );

    const insertResult = result as any;
    return res.status(201).json({
      message: "Servico criado com sucesso.",
      id_servico: insertResult.insertId,
    });
  } catch (err) {
    if (isForeignKeyError(err)) {
      return res.status(404).json({ message: "Especialidade nao encontrada." });
    }

    return sendServerError(res, err);
  }
});

router.put("/servicos/:id", barberAdminRequired, validate(servicoUpdateSchema), async (req: Request, res: Response) => {
  try {
    const idServico = Number(req.params.id);
    if (!Number.isInteger(idServico) || idServico <= 0) {
      return res.status(422).json({ message: "Id de servico invalido." });
    }

    const [foundRows] = await pool.query(
      `SELECT id_servico, nome, descricao, valor, tempo_medio, id_especialidade
       FROM servicos
       WHERE id_servico = ?
       LIMIT 1`,
      [idServico]
    );

    const services = foundRows as any[];
    if (!services.length) {
      return res.status(404).json({ message: "Servico nao encontrado." });
    }

    const current = services[0];
    const next = {
      nome: req.body.nome ?? current.nome,
      descricao: req.body.descricao ?? current.descricao,
      valor: req.body.valor ?? current.valor,
      tempo_medio: req.body.tempo_medio ?? current.tempo_medio,
      id_especialidade: req.body.id_especialidade ?? current.id_especialidade,
    };

    await pool.query(
      `UPDATE servicos
       SET nome = ?,
           descricao = ?,
           valor = ?,
           tempo_medio = ?,
           id_especialidade = ?
       WHERE id_servico = ?`,
      [next.nome, next.descricao, next.valor, next.tempo_medio, next.id_especialidade, idServico]
    );

    return res.json({ message: "Servico atualizado com sucesso." });
  } catch (err) {
    if (isForeignKeyError(err)) {
      return res.status(404).json({ message: "Especialidade nao encontrada." });
    }

    return sendServerError(res, err);
  }
});

router.delete("/servicos/:id", barberAdminRequired, async (req: Request, res: Response) => {
  try {
    const idServico = Number(req.params.id);
    if (!Number.isInteger(idServico) || idServico <= 0) {
      return res.status(422).json({ message: "Id de servico invalido." });
    }

    const [result] = await pool.query(
      `DELETE FROM servicos WHERE id_servico = ?`,
      [idServico]
    );

    const deleteResult = result as any;
    if (!deleteResult.affectedRows) {
      return res.status(404).json({ message: "Servico nao encontrado." });
    }

    return res.json({ message: "Servico excluido com sucesso." });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post("/barbeiro-especialidades", validate(barbeiroEspecialidadeSchema), async (req: Request, res: Response) => {
  try {
    if (!isBarberAdminUser(req.user)) {
      return res
        .status(403)
        .json({ message: "Apenas barbeiro admin pode gerenciar vinculos." });
    }

    const { id_barbeiro, id_especialidade } = req.body;

    await pool.query(
      `INSERT INTO barbeiro_especialidade (id_barbeiro, id_especialidade)
       VALUES (?, ?)`,
      [id_barbeiro, id_especialidade]
    );

    return res.status(201).json({
      message: "Vinculo barbeiro-especialidade criado com sucesso.",
      id_barbeiro,
      id_especialidade,
    });
  } catch (err) {
    if (isDuplicateError(err)) {
      return res.status(409).json({ message: "Vinculo ja existe." });
    }

    if (isForeignKeyError(err)) {
      return res
        .status(404)
        .json({ message: "Barbeiro ou especialidade nao encontrados." });
    }

    return sendServerError(res, err);
  }
});

router.post("/reservas", validate(reservaSchema), async (req: Request, res: Response) => {
  try {
    const { id_barbeiro, id_cliente, id_servico, data, horario_inicial } = req.body;

    const reservaDate = new Date(`${data}T00:00:00`);
    const now = new Date();
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (reservaDate < todayNoTime) {
      return res.status(422).json({
        message: "Data da reserva invalida. Nao pode ser anterior a hoje.",
      });
    }

    if (req.user?.role === "cliente" && Number(req.user.sub) !== id_cliente) {
      return res.status(403).json({
        message: "Cliente pode criar reservas apenas para si.",
      });
    }

    const [allowedRows] = await pool.query(
      `SELECT 1
       FROM servicos s
       INNER JOIN barbeiro_especialidade be ON be.id_especialidade = s.id_especialidade
       WHERE s.id_servico = ? AND be.id_barbeiro = ?
       LIMIT 1`,
      [id_servico, id_barbeiro]
    );

    if (!(allowedRows as any[]).length) {
      return res.status(422).json({
        message: "Barbeiro nao atende a especialidade deste servico.",
      });
    }

    const [busyRows] = await pool.query(
      `SELECT id_reserva
       FROM reservas
       WHERE id_barbeiro = ? AND data = ? AND horario_inicial = ? AND cancelado = FALSE
       LIMIT 1`,
      [id_barbeiro, data, horario_inicial]
    );

    if ((busyRows as any[]).length) {
      return res.status(409).json({
        message: "Barbeiro ja possui reserva nesse horario.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO reservas (id_barbeiro, id_cliente, id_servico, data, horario_inicial)
       VALUES (?, ?, ?, ?, ?)`,
      [id_barbeiro, id_cliente, id_servico, data, horario_inicial]
    );

    const insertResult = result as any;
    return res.status(201).json({
      message: "Reserva criada com sucesso.",
      id_reserva: insertResult.insertId,
    });
  } catch (err) {
    if (isForeignKeyError(err)) {
      return res
        .status(404)
        .json({
          message: "Barbeiro, cliente ou servico nao encontrados.",
        });
    }

    return sendServerError(res, err);
  }
});

router.get("/reservas", async (req: Request, res: Response) => {
  try {
    const { weekStart, includeCanceled } = req.query;
    const params: any[] = [];

    const includeCanceledParam = Array.isArray(includeCanceled)
      ? includeCanceled[0]
      : includeCanceled;
    const includeCanceledBool = String(includeCanceledParam || "").toLowerCase() === "true";

    let where = "WHERE 1=1";

    if (weekStart) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart))) {
        return res
          .status(422)
          .json({ message: "weekStart deve estar no formato YYYY-MM-DD." });
      }

      where += " AND r.data BETWEEN ?::date AND (?::date + INTERVAL '6 days')::date";
      params.push(weekStart, weekStart);
    }

    if (req.user?.role === "cliente") {
      where += " AND r.id_cliente = ?";
      params.push(Number(req.user.sub));
    }

    if (req.user?.role === "barbeiro" && req.user?.admin !== true) {
      where += " AND r.id_barbeiro = ?";
      params.push(Number(req.user.sub));
    }

    if (!includeCanceledBool) {
      where += " AND r.cancelado = FALSE";
    }

    const [rows] = await pool.query(
      `SELECT
        r.id_reserva,
        r.id_barbeiro,
        r.id_cliente,
        r.id_servico,
        TO_CHAR(r.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(r.horario_inicial, 'HH24:MI:SS') AS horario_inicial,
        r.cancelado AS cancelado,
        b.nome AS barbeiro_nome,
        b.cor AS barbeiro_cor,
        c.nome AS cliente_nome,
        s.nome AS servico_nome,
        s.tempo_medio AS tempo_medio
       FROM reservas r
       INNER JOIN barbeiros b ON b.id_barbeiro = r.id_barbeiro
       INNER JOIN clientes c ON c.id_cliente = r.id_cliente
       INNER JOIN servicos s ON s.id_servico = r.id_servico
       ${where}
       ORDER BY r.data ASC, r.horario_inicial ASC`,
      params
    );

    return res.json({ reservas: rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.put("/reservas/:id", validate(reservaUpdateSchema), async (req: Request, res: Response) => {
  try {
    const idReserva = Number(req.params.id);
    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      return res.status(422).json({ message: "Id de reserva inválido." });
    }

    const [foundRows] = await pool.query(
      `SELECT id_reserva, id_barbeiro, id_cliente, id_servico, data, horario_inicial, cancelado
       FROM reservas
       WHERE id_reserva = ?
       LIMIT 1`,
      [idReserva]
    );

    const reservations = foundRows as any[];
    if (!reservations.length) {
      return res.status(404).json({ message: "Reserva não encontrada." });
    }

    const current = reservations[0];

    if (current.cancelado) {
      return res
        .status(422)
        .json({ message: "Reserva cancelada não pode ser alterada." });
    }

    const [startedRows] = await pool.query(
      `SELECT 1
       FROM reservas
       WHERE id_reserva = ?
         AND (data + horario_inicial) <= NOW()
       LIMIT 1`,
      [idReserva]
    );

    if ((startedRows as any[]).length) {
      return res
        .status(422)
        .json({ message: "A reserva já iniciou e não pode ser editada." });
    }

    if (
      req.user?.role === "cliente" &&
      Number(req.user.sub) !== current.id_cliente
    ) {
      return res
        .status(403)
        .json({ message: "Cliente pode alterar apenas suas próprias reservas." });
    }

    if (
      req.user &&
      isBarberNonAdminUser(req.user) &&
      Number(req.user.sub) !== Number(current.id_barbeiro)
    ) {
      return res
        .status(403)
        .json({ message: "Barbeiro pode alterar apenas as próprias reservas." });
    }

    const next = {
      id_barbeiro: req.body.id_barbeiro ?? current.id_barbeiro,
      id_cliente: req.body.id_cliente ?? current.id_cliente,
      id_servico: req.body.id_servico ?? current.id_servico,
      data: req.body.data ?? current.data,
      horario_inicial: req.body.horario_inicial ?? current.horario_inicial,
    };

    if (
      req.user?.role === "cliente" &&
      Number(req.user.sub) !== Number(next.id_cliente)
    ) {
      return res.status(403).json({
        message: "Cliente não pode transferir reserva para outro cliente.",
      });
    }

    if (
      req.user &&
      isBarberNonAdminUser(req.user) &&
      Number(req.user.sub) !== Number(next.id_barbeiro)
    ) {
      return res.status(403).json({
        message: "Barbeiro não pode transferir reserva para outro barbeiro.",
      });
    }

    const [allowedRows] = await pool.query(
      `SELECT 1
       FROM servicos s
       INNER JOIN barbeiro_especialidade be ON be.id_especialidade = s.id_especialidade
       WHERE s.id_servico = ? AND be.id_barbeiro = ?
       LIMIT 1`,
      [next.id_servico, next.id_barbeiro]
    );

    if (!(allowedRows as any[]).length) {
      return res.status(422).json({
        message: "Barbeiro nao atende a especialidade deste servico.",
      });
    }

    const [busyRows] = await pool.query(
      `SELECT id_reserva
       FROM reservas
       WHERE id_barbeiro = ?
         AND data = ?
         AND horario_inicial = ?
         AND cancelado = FALSE
         AND id_reserva <> ?
       LIMIT 1`,
      [next.id_barbeiro, next.data, next.horario_inicial, idReserva]
    );

    if ((busyRows as any[]).length) {
      return res.status(409).json({
        message: "Barbeiro já possui reserva nesse horário.",
      });
    }

    await pool.query(
      `UPDATE reservas
       SET id_barbeiro = ?,
           id_cliente = ?,
           id_servico = ?,
           data = ?,
           horario_inicial = ?
       WHERE id_reserva = ?`,
      [
        next.id_barbeiro,
        next.id_cliente,
        next.id_servico,
        next.data,
        next.horario_inicial,
        idReserva,
      ]
    );

    return res.json({ message: "Reserva atualizada com sucesso." });
  } catch (err) {
    if (isForeignKeyError(err)) {
      return res.status(404).json({
        message: "Barbeiro, cliente ou serviço não encontrados.",
      });
    }

    return sendServerError(res, err);
  }
});

router.delete("/reservas/:id", async (req: Request, res: Response) => {
  try {
    const idReserva = Number(req.params.id);
    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      return res.status(422).json({ message: "Id de reserva inválido." });
    }

    const [foundRows] = await pool.query(
      `SELECT
         id_reserva,
         id_barbeiro,
         id_cliente,
         cancelado,
         TO_CHAR(data, 'YYYY-MM-DD') AS data,
         TO_CHAR(horario_inicial, 'HH24:MI:SS') AS horario_inicial
       FROM reservas
       WHERE id_reserva = ?
       LIMIT 1`,
      [idReserva]
    );

    const reservations = foundRows as any[];
    if (!reservations.length) {
      return res.status(404).json({ message: "Reserva não encontrada." });
    }

    if (
      req.user?.role === "cliente" &&
      Number(req.user.sub) !== Number(reservations[0].id_cliente)
    ) {
      return res
        .status(403)
        .json({
          message: "Cliente pode excluir apenas suas próprias reservas.",
        });
    }

    if (
      req.user &&
      isBarberNonAdminUser(req.user) &&
      Number(req.user.sub) !== Number(reservations[0].id_barbeiro)
    ) {
      return res
        .status(403)
        .json({
          message: "Barbeiro pode excluir apenas as próprias reservas.",
        });
    }

    if (reservations[0].cancelado) {
      return res.status(422).json({ message: "Reserva já está cancelada." });
    }

    if (req.user?.role === "cliente") {
      const reserva = reservations[0];
      const reservaDateTime = new Date(`${reserva.data}T${reserva.horario_inicial}`);
      const twoHoursMs = 2 * 60 * 60 * 1000;

      if (reservaDateTime.getTime() - Date.now() < twoHoursMs) {
        return res.status(422).json({
          message: "Cancelamento permitido apenas até 2 horas antes do horário da reserva.",
        });
      }
    }

    await pool.query(
      "UPDATE reservas SET cancelado = TRUE WHERE id_reserva = ?",
      [idReserva]
    );

    return res.json({ message: "Reserva cancelada com sucesso." });
  } catch (err) {
    return sendServerError(res, err);
  }
});

export default router;
