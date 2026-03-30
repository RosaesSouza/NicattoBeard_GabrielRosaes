import { spawnSync } from "child_process";

// Funcao responsavel por executar um comando externo de forma sincronizada, reaproveitando configuracao padrao de processo.
function run(
  command: string,
  args: string[]
): ReturnType<typeof spawnSync> {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });
}

// Funcao responsavel por pausar o script entre tentativas de health check do container PostgreSQL.
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const dockerCheck = spawnSync("docker", ["--version"], {
  stdio: "ignore",
  shell: false,
});

if (dockerCheck.error || dockerCheck.status !== 0) {
  console.error("Docker nao encontrado no PATH.");
  console.error(
    "Instale o Docker Desktop ou rode PostgreSQL localmente na porta 5432."
  );
  process.exit(1);
}

const compose = run("docker", ["compose", "up", "-d", "postgres"]);

if (compose.status !== 0) {
  process.exit(compose.status ?? 1);
}

const maxAttempts = 30;
let isHealthy = false;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const health = spawnSync(
    "docker",
    ["inspect", "--format={{.State.Health.Status}}", "nicatto-beard-postgres"],
    { encoding: "utf8", shell: false }
  );

  const status = (health.stdout || "").trim();
  if (health.status === 0 && status === "healthy") {
    isHealthy = true;
    break;
  }

  console.log(`Aguardando PostgreSQL ficar saudável... tentativa ${attempt}/${maxAttempts}`);
  sleep(2000);
}

if (!isHealthy) {
  console.error("PostgreSQL não ficou saudável no tempo esperado.");
  process.exit(1);
}

console.log("PostgreSQL saudável. Executando seed automaticamente...");
const seed = spawnSync("npm run seed", {
  stdio: "inherit",
  shell: true,
});

if (seed.status !== 0) {
  console.error("Falha ao executar seed automático.");
  process.exit(seed.status ?? 1);
}

console.log("Banco pronto e seed executado com sucesso.");
process.exit(0);
