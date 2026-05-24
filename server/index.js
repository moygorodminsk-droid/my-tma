import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_URL = process.env.CLIENT_URL || "*";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Утилита: валидация initData от Telegram
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return { valid: false, reason: "нет initData или BOT_TOKEN" };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false, reason: "нет hash в initData" };

    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (hash !== expectedHash) return { valid: false, reason: "hash не совпадает" };

    const authDate = parseInt(params.get("auth_date") || "0");
    const age = Math.floor(Date.now() / 1000) - authDate;

    return {
      valid: true,
      age_seconds: age,
      fresh: age < 86400,
    };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
}

// GET /health — проверка жизни сервера
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasBotToken: !!BOT_TOKEN,
      port: PORT,
      clientUrl: CLIENT_URL,
      nodeVersion: process.version,
    },
  });
});

app.post("/user", (req, res) => {
  const { initData } = req.body;
  const validation = validateInitData(initData);

  let user = null;
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      if (userStr) user = JSON.parse(userStr);
    } catch {}
  }

  res.json({
    validation,
    user,
    // Это то что ты безопасно можешь использовать в БД
    safe_user_id: validation.valid ? user?.id : null,
    message: validation.valid
      ? "initData валиден — пользователю можно доверять"
      : "initData не прошёл валидацию — не доверяй этим данным",
  });
});

// POST /ping — основной эндпоинт
app.post("/ping", (req, res) => {
  const { initData } = req.body;
  const validation = validateInitData(initData);

  let parsedUser = null;
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      if (userStr) parsedUser = JSON.parse(userStr);
    } catch {}
  }

  res.json({
    message: "Сервер ответил!",
    received_at: new Date().toISOString(),
    initData_validation: validation,
    user: parsedUser,
    request_info: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      headers: {
        "user-agent": req.headers["user-agent"],
        origin: req.headers["origin"],
      },
    },
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен: http://0.0.0.0:${PORT}`);
  console.log(`BOT_TOKEN: ${BOT_TOKEN ? "✅ есть" : "❌ не задан"}`);
});