import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import insertRoutes from "./routes/inserts.routes";

const IS_PROD = process.env.NODE_ENV === "production";

const app = express();

app.set("trust proxy", 1);

if (IS_PROD) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
}

app.use(
  cors({
    origin: IS_PROD
      ? process.env.FRONTEND_URL
      : [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:4173",
          "http://localhost:8080",
        ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/inserts", insertRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((req, res) => {
  return res.status(404).json({
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

export default app;
