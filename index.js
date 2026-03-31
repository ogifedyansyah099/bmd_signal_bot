const express = require("express");
const axios   = require("axios");

const app  = express();
app.use(express.json());

// ── ENV ──────────────────────────────────────────────────
const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
const CHAT_ID         = process.env.CHAT_ID;
const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET;
const PORT            = process.env.PORT || 3000;

// ── HELPER: kirim pesan Telegram ────────────────────────
async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id:    chatId,
    text:       text,
    parse_mode: "Markdown",
  });
}

// ── HELPER: format timeframe ─────────────────────────────
function formatTF(interval) {
  if (!interval) return "—";
  const map = {
    "1":   "1 Menit",   "2":   "2 Menit",   "3":   "3 Menit",
    "5":   "5 Menit",   "10":  "10 Menit",  "15":  "15 Menit",
    "30":  "30 Menit",  "45":  "45 Menit",
    "60":  "1 Jam",     "120": "2 Jam",     "180": "3 Jam",
    "240": "4 Jam",     "360": "6 Jam",     "480": "8 Jam",
    "720": "12 Jam",
    "1D":  "1 Hari",    "D":   "1 Hari",
    "1W":  "1 Minggu",  "W":   "1 Minggu",
    "1M":  "1 Bulan",   "M":   "1 Bulan",
  };
  return map[String(interval)] || interval + " Menit";
}

// ── HELPER: format pesan per tipe ───────────────────────
function buildMessage(body) {
  const { type, ticker, interval, price } = body;

  const p  = price  ? `\`${Number(price).toFixed(2)}\`` : "—";
  const tf = formatTF(interval);
  const tk = ticker || "—";

  switch (type) {
    case "BUY":
      return (
        `🟢 *REAPER BUY SIGNAL*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `📈 Trend : BULLISH\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚡ _Siap masuk BUY!_`
      );
    case "SELL":
      return (
        `🔴 *REAPER SELL SIGNAL*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `📉 Trend : BEARISH\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚡ _Siap masuk SELL!_`
      );
    case "CROSS_UP":
      return (
        `✕ *EMA CROSS UP*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🔔 EMA9 silang ke atas EMA21\n` +
        `👀 _Siap-siap BUY!_`
      );
    case "CROSS_DOWN":
      return (
        `✕ *EMA CROSS DOWN*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🔔 EMA9 silang ke bawah EMA21\n` +
        `👀 _Siap-siap SELL!_`
      );
    case "TP_HIT":
      return (
        `✅ *TP HIT — PROFIT!*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🎯 _Target tercapai!_`
      );
    case "SL_HIT":
      return (
        `❌ *SL HIT — STOP LOSS*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🛑 _Loss terkonfirmasi. Next setup!_`
      );
    default:
      return body.message || `📡 Signal diterima: ${type || "UNKNOWN"}`;
  }
}

// ── ROUTE: health check ──────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", bot: "BMD Signal Bot", version: "3.1" });
});

// ── ROUTE: webhook dari TradingView ─────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (!body.secret || body.secret !== WEBHOOK_SECRET) {
      console.warn("⛔ Secret tidak valid:", body.secret);
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("📡 Webhook masuk:", JSON.stringify(body));

    const targetChat = body.chat_id || CHAT_ID;
    const text = buildMessage(body);
    await sendTelegram(targetChat, text);

    console.log("✅ Pesan terkirim ke Telegram");
    res.json({ ok: true, type: body.type });

  } catch (err) {
    console.error("❌ Error webhook:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ROUTE: test manual ───────────────────────────────────
app.get("/test", async (req, res) => {
  try {
    await sendTelegram(CHAT_ID,
      `🤖 *BMD Signal Bot aktif!*\n` +
      `✅ Webhook siap menerima sinyal dari TradingView.\n` +
      `📦 Versi: 3.1`
    );
    res.json({ ok: true, message: "Test message sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 BMD Signal Bot v3.1 running on port ${PORT}`);
});
