import { copyFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const envExamplePath = join(projectRoot, ".env.example");
const envPath = join(projectRoot, ".env");

if (!existsSync(envExamplePath)) {
  console.error("Arquivo .env.example nao encontrado.");
  process.exit(1);
}

if (existsSync(envPath)) {
  console.log(".env ja existe. Nenhuma alteracao foi feita.");
  process.exit(0);
}

copyFileSync(envExamplePath, envPath);
console.log(".env criado a partir de .env.example com sucesso.");
console.log("Revise o JWT_SECRET antes de subir em ambientes compartilhados.");
