import bcrypt from "bcryptjs";
import { pool } from "./bd";

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

interface Cliente {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}

interface Barbeiro {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  nascimento: string;
  contratacao: string;
  admin: boolean;
  cor: string;
}

interface Especialidade {
  nome: string;
  descricao: string;
}

interface Servico {
  nome: string;
  descricao: string;
  valor: number;
  tempo_medio: number;
  especialidadeNome: string;
}

interface BarbeiroEspecialidade {
  barbeiroEmail: string;
  especialidadeNome: string;
}

interface Reserva {
  barbeiroEmail: string;
  clienteEmail: string;
  servicoNome: string;
  data: string;
  horario_inicial: string;
  cancelado?: boolean;
}

const clientes: Cliente[] = [
  { nome: "Kaique Moura", email: "kaique.moura92@barbearia.local", telefone: "(11) 99999-0001", senha: "Qm!72a#9Lp" },
  { nome: "Talita Nunes", email: "talita.nunes17@barbearia.local", telefone: "(11) 99999-0002", senha: "Rt@44mX#21" },
  { nome: "Lucas Andrade", email: "lucas.andrade21@barbearia.local", telefone: "(11) 99999-0003", senha: "Ab#22Lp!90" },
  { nome: "Mariana Souza", email: "mariana.souza77@barbearia.local", telefone: "(11) 99999-0004", senha: "Zx!88Mm@12" },
  { nome: "Pedro Henrique", email: "pedro.henrique11@barbearia.local", telefone: "(11) 99999-0005", senha: "Kp@91Lx#33" },
  { nome: "Fernanda Lima", email: "fernanda.lima55@barbearia.local", telefone: "(11) 99999-0006", senha: "Tr#55Xy!22" },
  { nome: "Rafael Gomes", email: "rafael.gomes99@barbearia.local", telefone: "(11) 99999-0007", senha: "Ui@77Kl#44" },
];

const barbeiros: Barbeiro[] = [
  {
    nome: "Enzo Vilar",
    email: "enzo.vilar58@barbearia.local",
    telefone: "(11) 99999-0011",
    senha: "Ua#8pL!406",
    nascimento: "1995-06-15",
    contratacao: "2022-01-10",
    admin: true,
    cor: "#1976d2",
  },
  {
    nome: "Bruno Azevedo",
    email: "bruno.azevedo33@barbearia.local",
    telefone: "(11) 99999-0012",
    senha: "Hx!29q@M77",
    nascimento: "1992-09-20",
    contratacao: "2023-03-05",
    admin: false,
    cor: "#2e7d32",
  },
  {
    nome: "Livia Cardoso",
    email: "livia.cardoso61@barbearia.local",
    telefone: "(11) 99999-0013",
    senha: "Nw@54rT#18",
    nascimento: "1998-11-02",
    contratacao: "2024-02-18",
    admin: false,
    cor: "#c2185b",
  },
  {
    nome: "Gabriel Martins",
    email: "gabriel.martins88@barbearia.local",
    telefone: "(11) 99999-0014",
    senha: "Qw!33Er#99",
    nascimento: "1990-03-10",
    contratacao: "2021-07-22",
    admin: false,
    cor: "#f57c00",
  },
];

const especialidades: Especialidade[] = [
  { nome: "Corte Masculino", descricao: "Cortes tradicionais e modernos." },
  { nome: "Barba", descricao: "Modelagem e acabamento de barba." },
  { nome: "Coloracao", descricao: "Pigmentacao e coloracao capilar." },
  { nome: "Sobrancelha", descricao: "Design e alinhamento de sobrancelha." },
];

const servicos: Servico[] = [
  {
    nome: "Corte Degrade",
    descricao: "Corte degrade completo com acabamento na navalha.",
    valor: 45.0,
    tempo_medio: 1,
    especialidadeNome: "Corte Masculino",
  },
  {
    nome: "Corte Social",
    descricao: "Corte classico na tesoura.",
    valor: 40.0,
    tempo_medio: 1,
    especialidadeNome: "Corte Masculino",
  },
  {
    nome: "Barba Completa",
    descricao: "Toalha quente, desenho e finalizacao.",
    valor: 35.0,
    tempo_medio: 1,
    especialidadeNome: "Barba",
  },
  {
    nome: "Barba Express",
    descricao: "Ajuste rapido de barba.",
    valor: 20.0,
    tempo_medio: 1,
    especialidadeNome: "Barba",
  },
  {
    nome: "Coloracao Capilar",
    descricao: "Coloracao completa.",
    valor: 90.0,
    tempo_medio: 1,
    especialidadeNome: "Coloracao",
  },
  {
    nome: "Luzes",
    descricao: "Clareamento parcial.",
    valor: 120.0,
    tempo_medio: 1,
    especialidadeNome: "Coloracao",
  },
  {
    nome: "Sobrancelha",
    descricao: "Design de sobrancelha.",
    valor: 15.0,
    tempo_medio: 1,
    especialidadeNome: "Sobrancelha",
  },
];

const barbeiroEspecialidades: BarbeiroEspecialidade[] = [
  { barbeiroEmail: "enzo.vilar58@barbearia.local", especialidadeNome: "Corte Masculino" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", especialidadeNome: "Barba" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", especialidadeNome: "Barba" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", especialidadeNome: "Coloracao" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", especialidadeNome: "Corte Masculino" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", especialidadeNome: "Corte Masculino" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", especialidadeNome: "Sobrancelha" },
];

const reservas: Reserva[] = [
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "kaique.moura92@barbearia.local", servicoNome: "Corte Degrade", data: "2026-03-27", horario_inicial: "09:00:00" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "talita.nunes17@barbearia.local", servicoNome: "Barba Completa", data: "2026-03-27", horario_inicial: "09:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "mariana.souza77@barbearia.local", servicoNome: "Coloracao Capilar", data: "2026-03-27", horario_inicial: "10:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "lucas.andrade21@barbearia.local", servicoNome: "Corte Social", data: "2026-03-27", horario_inicial: "10:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "rafael.gomes99@barbearia.local", servicoNome: "Barba Completa", data: "2026-03-28", horario_inicial: "09:00:00" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "pedro.henrique11@barbearia.local", servicoNome: "Barba Express", data: "2026-03-28", horario_inicial: "09:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "fernanda.lima55@barbearia.local", servicoNome: "Luzes", data: "2026-03-28", horario_inicial: "11:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "kaique.moura92@barbearia.local", servicoNome: "Sobrancelha", data: "2026-03-28", horario_inicial: "11:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "lucas.andrade21@barbearia.local", servicoNome: "Corte Social", data: "2026-03-29", horario_inicial: "09:00:00" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "rafael.gomes99@barbearia.local", servicoNome: "Barba Completa", data: "2026-03-29", horario_inicial: "10:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "mariana.souza77@barbearia.local", servicoNome: "Coloracao Capilar", data: "2026-03-29", horario_inicial: "09:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "pedro.henrique11@barbearia.local", servicoNome: "Corte Social", data: "2026-03-29", horario_inicial: "11:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "kaique.moura92@barbearia.local", servicoNome: "Corte Degrade", data: "2026-03-30", horario_inicial: "09:00:00" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "talita.nunes17@barbearia.local", servicoNome: "Barba Express", data: "2026-03-30", horario_inicial: "09:00:00", cancelado: true },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "fernanda.lima55@barbearia.local", servicoNome: "Corte Social", data: "2026-03-30", horario_inicial: "10:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "rafael.gomes99@barbearia.local", servicoNome: "Sobrancelha", data: "2026-03-30", horario_inicial: "10:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "pedro.henrique11@barbearia.local", servicoNome: "Corte Social", data: "2026-03-31", horario_inicial: "09:00:00" },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "rafael.gomes99@barbearia.local", servicoNome: "Barba Completa", data: "2026-03-31", horario_inicial: "09:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "mariana.souza77@barbearia.local", servicoNome: "Luzes", data: "2026-03-31", horario_inicial: "11:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "talita.nunes17@barbearia.local", servicoNome: "Sobrancelha", data: "2026-03-31", horario_inicial: "10:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "kaique.moura92@barbearia.local", servicoNome: "Barba Completa", data: "2026-04-01", horario_inicial: "09:00:00", cancelado: true },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "pedro.henrique11@barbearia.local", servicoNome: "Barba Express", data: "2026-04-01", horario_inicial: "09:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "fernanda.lima55@barbearia.local", servicoNome: "Coloracao Capilar", data: "2026-04-01", horario_inicial: "09:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "mariana.souza77@barbearia.local", servicoNome: "Corte Social", data: "2026-04-01", horario_inicial: "09:00:00" },
  { barbeiroEmail: "enzo.vilar58@barbearia.local", clienteEmail: "lucas.andrade21@barbearia.local", servicoNome: "Corte Degrade", data: "2026-04-02", horario_inicial: "09:00:00", cancelado: true },
  { barbeiroEmail: "bruno.azevedo33@barbearia.local", clienteEmail: "rafael.gomes99@barbearia.local", servicoNome: "Barba Completa", data: "2026-04-02", horario_inicial: "09:00:00" },
  { barbeiroEmail: "livia.cardoso61@barbearia.local", clienteEmail: "mariana.souza77@barbearia.local", servicoNome: "Coloracao Capilar", data: "2026-04-02", horario_inicial: "10:00:00" },
  { barbeiroEmail: "gabriel.martins88@barbearia.local", clienteEmail: "talita.nunes17@barbearia.local", servicoNome: "Sobrancelha", data: "2026-04-02", horario_inicial: "10:00:00" },
];

async function getSingleValue(
  sql: string,
  params: any[],
  field: string
): Promise<any> {
  const [rows] = await pool.query(sql, params);
  const result = rows as any[];
  if (!result.length) return null;
  return result[0][field];
}

async function getClienteIdByEmail(email: string): Promise<number | null> {
  return getSingleValue(
    "SELECT id_cliente FROM clientes WHERE email = ? LIMIT 1",
    [email],
    "id_cliente"
  );
}

async function getBarbeiroIdByEmail(email: string): Promise<number | null> {
  return getSingleValue(
    "SELECT id_barbeiro FROM barbeiros WHERE email = ? LIMIT 1",
    [email],
    "id_barbeiro"
  );
}

async function getEspecialidadeIdByNome(nome: string): Promise<number | null> {
  return getSingleValue(
    "SELECT id_especialidade FROM especialidade WHERE nome = ? LIMIT 1",
    [nome],
    "id_especialidade"
  );
}

async function getServicoIdByNome(nome: string): Promise<number | null> {
  return getSingleValue(
    "SELECT id_servico FROM servicos WHERE nome = ? LIMIT 1",
    [nome],
    "id_servico"
  );
}

async function main(): Promise<void> {
  for (const c of clientes) {
    const hash = await bcrypt.hash(c.senha, BCRYPT_SALT_ROUNDS);
    await pool.query(
      `INSERT INTO clientes (nome, telefone, email, senha)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         telefone = EXCLUDED.telefone,
         senha = EXCLUDED.senha`,
      [c.nome, c.telefone, c.email, hash]
    );
    console.log(`Seed cliente: ${c.email}`);
  }

  for (const b of barbeiros) {
    const hash = await bcrypt.hash(b.senha, BCRYPT_SALT_ROUNDS);
    await pool.query(
      `INSERT INTO barbeiros (nome, telefone, email, senha, nascimento, contratacao, admin, cor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         telefone = EXCLUDED.telefone,
         senha = EXCLUDED.senha,
         nascimento = EXCLUDED.nascimento,
         contratacao = EXCLUDED.contratacao,
         admin = EXCLUDED.admin,
         cor = EXCLUDED.cor`,
      [b.nome, b.telefone, b.email, hash, b.nascimento, b.contratacao, b.admin, b.cor]
    );
    console.log(`Seed barbeiro: ${b.email}`);
  }

  for (const e of especialidades) {
    const existingId = await getEspecialidadeIdByNome(e.nome);
    if (existingId) {
      await pool.query(
        `UPDATE especialidade
         SET descricao = ?
         WHERE id_especialidade = ?`,
        [e.descricao, existingId]
      );
      console.log(`Seed especialidade (update): ${e.nome}`);
      continue;
    }

    await pool.query(
      `INSERT INTO especialidade (nome, descricao)
       VALUES (?, ?)`,
      [e.nome, e.descricao]
    );
    console.log(`Seed especialidade (insert): ${e.nome}`);
  }

  for (const s of servicos) {
    const idEspecialidade = await getEspecialidadeIdByNome(s.especialidadeNome);
    if (!idEspecialidade) {
      throw new Error(`Especialidade nao encontrada para servico: ${s.nome}`);
    }

    const idServico = await getServicoIdByNome(s.nome);
    if (idServico) {
      await pool.query(
        `UPDATE servicos
         SET descricao = ?, valor = ?, tempo_medio = ?, id_especialidade = ?
         WHERE id_servico = ?`,
        [s.descricao, s.valor, s.tempo_medio, idEspecialidade, idServico]
      );
      console.log(`Seed servico (update): ${s.nome}`);
      continue;
    }

    await pool.query(
      `INSERT INTO servicos (nome, descricao, valor, tempo_medio, id_especialidade)
       VALUES (?, ?, ?, ?, ?)`,
      [s.nome, s.descricao, s.valor, s.tempo_medio, idEspecialidade]
    );
    console.log(`Seed servico (insert): ${s.nome}`);
  }

  for (const be of barbeiroEspecialidades) {
    const idBarbeiro = await getBarbeiroIdByEmail(be.barbeiroEmail);
    const idEspecialidade = await getEspecialidadeIdByNome(be.especialidadeNome);

    if (!idBarbeiro || !idEspecialidade) {
      throw new Error(
        `Nao foi possivel vincular barbeiro/especialidade: ${be.barbeiroEmail} - ${be.especialidadeNome}`
      );
    }

    await pool.query(
      `INSERT INTO barbeiro_especialidade (id_barbeiro, id_especialidade)
       VALUES (?, ?)
       ON CONFLICT (id_barbeiro, id_especialidade) DO NOTHING`,
      [idBarbeiro, idEspecialidade]
    );

    console.log(
      `Seed barbeiro_especialidade: ${be.barbeiroEmail} -> ${be.especialidadeNome}`
    );
  }

  for (const r of reservas) {
    const idBarbeiro = await getBarbeiroIdByEmail(r.barbeiroEmail);
    const idCliente = await getClienteIdByEmail(r.clienteEmail);
    const idServico = await getServicoIdByNome(r.servicoNome);
    const cancelado = Boolean(r.cancelado);

    if (!idBarbeiro || !idCliente || !idServico) {
      throw new Error(
        `Nao foi possivel criar reserva: ${r.clienteEmail} com ${r.barbeiroEmail} para ${r.servicoNome}`
      );
    }

    const [existingReserva] = await pool.query(
      `SELECT id_reserva
       FROM reservas
       WHERE id_barbeiro = ? AND id_cliente = ? AND id_servico = ? AND data = ? AND horario_inicial = ?
       LIMIT 1`,
      [idBarbeiro, idCliente, idServico, r.data, r.horario_inicial]
    );

    const existing = existingReserva as any[];
    if (existing.length) {
      await pool.query(
        `UPDATE reservas
         SET cancelado = ?
         WHERE id_reserva = ?`,
        [cancelado, existing[0].id_reserva]
      );
      console.log(
        `Seed reserva (update): ${r.clienteEmail} ${r.data} ${r.horario_inicial} cancelado=${cancelado}`
      );
      continue;
    }

    await pool.query(
      `INSERT INTO reservas (id_barbeiro, id_cliente, id_servico, data, horario_inicial, cancelado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idBarbeiro, idCliente, idServico, r.data, r.horario_inicial, cancelado]
    );
    console.log(
      `Seed reserva (insert): ${r.clienteEmail} ${r.data} ${r.horario_inicial}`
    );
  }

  console.log("Seed finalizado!");
  await pool.end();
}

main().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
