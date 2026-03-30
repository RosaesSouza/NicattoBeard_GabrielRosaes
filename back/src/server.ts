import app from "./app";
import { schedule } from "node-cron";
import { pool } from "./bd";

schedule("0 0 * * *", async () => {
  try {
    const [result] = await pool.query(
      "DELETE FROM refresh_tokens WHERE expires_at < NOW()"
    );
    const insertResult = result as any;
    console.log(
      `[cron] ${insertResult.affectedRows} refresh token(s) expirado(s) removido(s).`
    );
  } catch (err) {
    console.error("[cron] Erro ao limpar refresh tokens:", (err as Error).message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("API on port", PORT);
});
