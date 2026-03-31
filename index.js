const express = require("express");
const axios   = require("axios");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID        = process.env.CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MT5_SECRET     = process.env.MT5_SECRET || "mt5_reaper_2024";
const PORT           = process.env.PORT || 3000;

// ── Signal queue untuk MT5 ───────────────────────────────
let pendingSignals = [];

// ── Format TF ────────────────────────────────────────────
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

// ── Kirim Telegram ────────────────────────────────────────
async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text, parse_mode: "Markdown" });
}

// ── Build pesan ───────────────────────────────────────────
function buildMessage(body) {
  const { type, ticker, interval, price, score, tp, sl } = body;
  const tk    = ticker   || "—";
  const tf    = formatTF(interval);
  const p     = price ? `\`${Number(price).toFixed(2)}\`` : "—";
  const tpv   = tp    ? `\`${Number(tp).toFixed(2)}\``   : "—";
  const slv   = sl    ? `\`${Number(sl).toFixed(2)}\``   : "—";
  const sc    = score ? `${score}/5` : "—";
  const stars = score ? "⭐".repeat(Math.min(parseInt(score), 5)) : "";

  switch (type) {
    case "BUY":
      return `🟢 *REAPER BUY SIGNAL*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `📌 Pair   : *${tk}*\n` +
             `⏱ TF     : *${tf}*\n` +
             `💰 Entry  : ${p}\n` +
             `🎯 TP     : ${tpv}\n` +
             `🛑 SL     : ${slv}\n` +
             `💪 Score  : ${sc} ${stars}\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `⚡ _Siap masuk BUY!_\n` +
             `🤖 _MT5 auto order diproses..._`;

    case "SELL":
      return `🔴 *REAPER SELL SIGNAL*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `📌 Pair   : *${tk}*\n` +
             `⏱ TF     : *${tf}*\n` +
             `💰 Entry  : ${p}\n` +
             `🎯 TP     : ${tpv}\n` +
             `🛑 SL     : ${slv}\n` +
             `💪 Score  : ${sc} ${stars}\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `⚡ _Siap masuk SELL!_\n` +
             `🤖 _MT5 auto order diproses..._`;

    case "TP_HIT":
      return `✅ *TP HIT — PROFIT!*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `📌 Pair  : *${tk}*\n` +
             `⏱ TF    : *${tf}*\n` +
             `💰 Price : ${p}\n` +
             `🎯 _Target tercapai!_`;

    case "SL_HIT":
      return `❌ *SL HIT — STOP LOSS*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `📌 Pair  : *${tk}*\n` +
             `⏱ TF    : *${tf}*\n` +
             `💰 Price : ${p}\n` +
             `🛑 _Loss terkonfirmasi. Next setup!_`;

    case "MT5_EXECUTED":
      return `🤖 *MT5 ORDER EXECUTED*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n` +
             `📌 Pair    : *${tk}*\n` +
             `📋 Type    : *${body.orderType || "—"}*\n` +
             `💰 Price   : ${p}\n` +
             `🎯 TP      : ${tpv}\n` +
             `🛑 SL      : ${slv}\n` +
             `📦 Lot     : \`${body.lot || "0.01"}\`\n` +
             `🎫 Ticket  : \`${body.ticket || "—"}\``;

    case "MT5_SKIPPED":
      return `⏭ *MT5 SINYAL DILEWATI*\n` +
             `📌 Pair   : *${tk}*\n` +
             `❓ Alasan : ${body.reason || "—"}`;

    default:
      return body.message || `📡 Signal: ${type || "UNKNOWN"}`;
  }
}

// ════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    bot:     "BMD Signal Bot",
    version: "5.0",
    queue:   pendingSignals.filter(s => !s.executed).length
  });
});

// ── Webhook dari TradingView ──────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (!body.secret || body.secret !== WEBHOOK_SECRET) {
      console.warn("⛔ Secret tidak valid");
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("📡 Webhook:", body.type, body.ticker, body.interval);

    // Kirim notif Telegram
    const targetChat = body.chat_id || CHAT_ID;
    await sendTelegram(targetChat, buildMessage(body));

    // BUY/SELL → masuk queue MT5
    if (body.type === "BUY" || body.type === "SELL") {
      const signal = {
        id:        Date.now(),
        type:      body.type,
        ticker:    body.ticker    || "",
        interval:  body.interval  || "",
        price:     parseFloat(body.price) || 0,
        tp:        parseFloat(body.tp)    || 0,
        sl:        parseFloat(body.sl)    || 0,
        score:     parseInt(body.score)   || 0,
        timestamp: new Date().toISOString(),
        executed:  false
      };
      pendingSignals.push(signal);

      // Bersihkan queue lama > 50 entry
      if (pendingSignals.length > 50)
        pendingSignals = pendingSignals.slice(-50);

      console.log("📥 Queue MT5:", signal.id, signal.type, signal.ticker,
                  "| TP:", signal.tp, "SL:", signal.sl);
    }

    res.json({ ok: true, type: body.type });

  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── MT5 polling — ambil sinyal pending ───────────────────
app.get("/mt5/signal", (req, res) => {
  const secret = req.headers["x-mt5-secret"] || req.query.secret;
  if (secret !== MT5_SECRET)
    return res.status(403).json({ error: "Unauthorized" });

  // Filter by ticker — EA kirim symbol-nya supaya ambil sinyal yang sesuai
  const sym = (req.query.symbol || req.query.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g,"");

  let signal;
  if (sym) {
    // Cari sinyal yang match dengan symbol EA (exact atau starts with)
    signal = pendingSignals.find(s => !s.executed &&
      (s.ticker.toUpperCase() === sym ||
       s.ticker.toUpperCase().startsWith(sym) ||
       sym.startsWith(s.ticker.toUpperCase()))
    );
  } else {
    // Fallback: ambil sinyal pertama (backward compatible)
    signal = pendingSignals.find(s => !s.executed);
  }

  if (!signal)
    return res.json({ signal: null, queue: 0 });

  res.json({
    signal,
    queue: pendingSignals.filter(s => !s.executed).length
  });
});

// ── MT5 konfirmasi eksekusi ───────────────────────────────
app.post("/mt5/confirm", async (req, res) => {
  const secret = req.headers["x-mt5-secret"] || req.body.secret;
  if (secret !== MT5_SECRET)
    return res.status(403).json({ error: "Unauthorized" });

  const { id, ticket, lot, price, tp, sl, orderType, ticker, skipped, reason } = req.body;

  // Mark executed
  const signal = pendingSignals.find(s => s.id == id);
  if (signal) signal.executed = true;

  console.log(skipped
    ? `⏭ MT5 skip signal ${id}: ${reason}`
    : `✅ MT5 eksekusi signal ${id} ticket ${ticket}`);

  // Notif Telegram
  try {
    const msgType = skipped ? "MT5_SKIPPED" : "MT5_EXECUTED";
    await sendTelegram(CHAT_ID, buildMessage({
      type: msgType, ticker, price, tp, sl,
      orderType, ticket, lot, reason
    }));
  } catch (e) {
    console.error("Telegram error:", e.message);
  }

  res.json({ ok: true });
});

// ── Test ──────────────────────────────────────────────────
app.get("/test", async (req, res) => {
  try {
    await sendTelegram(CHAT_ID,
      `🤖 *BMD Signal Bot v5.0 aktif!*\n` +
      `✅ TradingView webhook: ready\n` +
      `🤖 MT5 polling: ready\n` +
      `📦 Queue: ${pendingSignals.filter(s=>!s.executed).length} sinyal pending`
    );
    res.json({ ok: true, version: "5.0" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 BMD Signal Bot v5.0 running on port ${PORT}`)
);
