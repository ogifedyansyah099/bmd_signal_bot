const express = require("express");
const axios   = require("axios");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID        = process.env.CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PORT           = process.env.PORT || 3000;

async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text, parse_mode: "Markdown" });
}

function formatTF(interval) {
  const map = {
    "1":"1 Menit","2":"2 Menit","3":"3 Menit","5":"5 Menit",
    "10":"10 Menit","15":"15 Menit","30":"30 Menit","45":"45 Menit",
    "60":"1 Jam","120":"2 Jam","180":"3 Jam","240":"4 Jam",
    "360":"6 Jam","480":"8 Jam","720":"12 Jam",
    "1D":"1 Hari","D":"1 Hari","1W":"1 Minggu","W":"1 Minggu",
    "1M":"1 Bulan","M":"1 Bulan"
  };
  return map[String(interval)] || (interval + " Menit");
}

function buildMessage(body) {
  const { type, ticker, interval, price, score, tp, sl } = body;

  const tk  = ticker   || "—";
  const tf  = formatTF(interval);
  const p   = price    ? `\`${Number(price).toFixed(2)}\`` : "—";
  const tpv = tp       ? `\`${Number(tp).toFixed(2)}\``   : "—";
  const slv = sl       ? `\`${Number(sl).toFixed(2)}\``   : "—";
  const sc  = score    ? `${score}/5` : "—";

  const stars = score ? "⭐".repeat(Math.min(parseInt(score), 5)) : "";

  switch (type) {
    case "BUY":
      return (
        `🟢 *REAPER BUY SIGNAL*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair   : *${tk}*\n` +
        `⏱ TF     : *${tf}*\n` +
        `💰 Price  : ${p}\n` +
        `🎯 TP     : ${tpv}\n` +
        `🛑 SL     : ${slv}\n` +
        `💪 Score  : ${sc} ${stars}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ _Siap masuk BUY!_`
      );
    case "SELL":
      return (
        `🔴 *REAPER SELL SIGNAL*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair   : *${tk}*\n` +
        `⏱ TF     : *${tf}*\n` +
        `💰 Price  : ${p}\n` +
        `🎯 TP     : ${tpv}\n` +
        `🛑 SL     : ${slv}\n` +
        `💪 Score  : ${sc} ${stars}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ _Siap masuk SELL!_`
      );
    case "CROSS_UP":
      return (
        `✕ *EMA CROSS UP*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🔔 EMA9 silang ke atas EMA21\n` +
        `👀 _Siap-siap BUY!_`
      );
    case "CROSS_DOWN":
      return (
        `✕ *EMA CROSS DOWN*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🔔 EMA9 silang ke bawah EMA21\n` +
        `👀 _Siap-siap SELL!_`
      );
    case "TP_HIT":
      return (
        `✅ *TP HIT — PROFIT!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🎯 _Target tercapai!_`
      );
    case "SL_HIT":
      return (
        `❌ *SL HIT — STOP LOSS*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Price : ${p}\n` +
        `🛑 _Loss terkonfirmasi. Next setup!_`
      );
    default:
      return body.message || `📡 Signal: ${type || "UNKNOWN"}`;
  }
}

app.get("/", (req, res) => {
  res.json({ status: "ok", bot: "BMD Signal Bot", version: "4.0" });
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    if (!body.secret || body.secret !== WEBHOOK_SECRET) {
      console.warn("⛔ Secret tidak valid");
      return res.status(403).json({ error: "Unauthorized" });
    }
    console.log("📡 Webhook:", JSON.stringify(body));
    const targetChat = body.chat_id || CHAT_ID;
    const text = buildMessage(body);
    await sendTelegram(targetChat, text);
    console.log("✅ Terkirim:", body.type);
    res.json({ ok: true, type: body.type });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/test", async (req, res) => {
  try {
    await sendTelegram(CHAT_ID,
      `🤖 *BMD Signal Bot v4.0 aktif!*\n` +
      `✅ Webhook siap menerima sinyal.\n` +
      `🚀 Reaper Scalp PRO v4 connected.`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 BMD Signal Bot v4.0 on port ${PORT}`));
