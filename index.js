const express = require("express");
const axios   = require("axios");

const app  = express();
app.use(express.json());

// ── ENV ──────────────────────────────────────────────────────────────
const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
const CHAT_ID         = process.env.CHAT_ID;
const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET;       // dari TradingView
const MT5_SECRET      = process.env.MT5_SECRET || "mt5_reaper_2024"; // dari EA
const PORT            = process.env.PORT || 3000;

// ── IN-MEMORY SIGNAL QUEUE ───────────────────────────────────────────
// Simpan 1 signal per symbol. EA polling ambil dari sini.
// Format: { [symbol]: SignalObject }
const signalQueue = {};

// History konfirmasi (optional, buat logging)
const confirmHistory = [];

// Auto-increment ID untuk setiap signal masuk
let signalCounter = Date.now();

// ── HELPER: kirim pesan Telegram ─────────────────────────────────────
async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id:    chatId,
    text:       text,
    parse_mode: "Markdown",
  });
}

// ── HELPER: format pesan per tipe ────────────────────────────────────
function buildMessage(body) {
  const { type, ticker, interval, price, score, tp, sl } = body;

  const p   = price ? `\`${Number(price).toFixed(2)}\`` : "—";
  const tpF = tp    ? `\`${Number(tp).toFixed(2)}\``    : "—";
  const slF = sl    ? `\`${Number(sl).toFixed(2)}\``    : "—";
  const tf  = interval || "—";
  const tk  = ticker   || "—";
  const sc  = score    ? `⭐ ${score}/6` : "";

  switch (type) {
    case "BUY":
      return (
        `🟢 *REAPER BUY SIGNAL*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair  : *${tk}*\n` +
        `⏱ TF    : *${tf}*\n` +
        `💰 Entry : ${p}\n` +
        `🎯 TP    : ${tpF}\n` +
        `🛑 SL    : ${slF}\n` +
        `${sc}\n` +
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
        `💰 Entry : ${p}\n` +
        `🎯 TP    : ${tpF}\n` +
        `🛑 SL    : ${slF}\n` +
        `${sc}\n` +
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

// ── HELPER: normalisasi symbol (strip suffix broker) ──────────────────
// Contoh: "XAUUSDm" → "XAUUSD", "XAUUSD." → "XAUUSD"
function normalizeSymbol(sym) {
  if (!sym) return "";
  return sym.replace(/[^A-Z]/gi, "").substring(0, 6).toUpperCase();
}

// ════════════════════════════════════════════════════════════════════
// ROUTE: health check
// ════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    bot:     "BMD Signal Bot",
    version: "4.0",
    queue:   Object.keys(signalQueue).length + " signals pending",
  });
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: webhook dari TradingView / Pine Script
// POST /webhook
// Body: { secret, chat_id?, type, ticker, interval, price, score, tp, sl }
// ════════════════════════════════════════════════════════════════════
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // 1. Validasi secret
    if (!body.secret || body.secret !== WEBHOOK_SECRET) {
      console.warn("⛔ Secret tidak valid:", body.secret);
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("📡 Webhook masuk:", JSON.stringify(body));

    const targetChat = body.chat_id || CHAT_ID;

    // 2. Kirim notif Telegram
    const text = buildMessage(body);
    await sendTelegram(targetChat, text);
    console.log("✅ Pesan terkirim ke Telegram");

    // 3. Kalau type BUY atau SELL → masukkan ke signal queue untuk MT5
    if (body.type === "BUY" || body.type === "SELL") {
      const sym = normalizeSymbol(body.ticker);
      const sigId = ++signalCounter;

      signalQueue[sym] = {
        id:         sigId,
        type:       body.type,
        ticker:     sym,
        price:      body.price   || "0",
        tp:         body.tp      || "0",
        sl:         body.sl      || "0",
        score:      body.score   || "0",
        interval:   body.interval || "",
        receivedAt: Date.now(),
      };

      console.log(`📥 Signal queued: ${body.type} ${sym} ID=${sigId}`);
    }

    res.json({ ok: true, type: body.type });

  } catch (err) {
    console.error("❌ Error webhook:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: EA MT5 polling — ambil signal pending
// GET /mt5/signal?secret=xxx&symbol=XAUUSD
// ════════════════════════════════════════════════════════════════════
app.get("/mt5/signal", (req, res) => {
  const { secret, symbol } = req.query;

  // Validasi secret MT5
  if (!secret || secret !== MT5_SECRET) {
    console.warn("⛔ MT5 secret tidak valid:", secret);
    return res.status(403).json({ error: "Unauthorized" });
  }

  const sym = normalizeSymbol(symbol);
  if (!sym) {
    return res.status(400).json({ error: "symbol required" });
  }

  const sig = signalQueue[sym] || null;

 // Kalau ada signal, cek expiry (DIPERPANJANG)
if (sig) {
  const age = (Date.now() - sig.receivedAt) / 1000;
  if (age > 300) { // ⬅️ dari 60 jadi 300 detik
    console.log(`⏰ Signal ${sym} expired di server (${age.toFixed(0)}s). Dihapus.`);
    delete signalQueue[sym];
    return res.json({ signal: null });
  }
}

  console.log(`🔍 MT5 poll [${sym}]: ${sig ? "ADA signal ID=" + sig.id : "kosong"}`);
  res.json({ signal: sig });
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: EA MT5 konfirmasi setelah entry / skip
// POST /mt5/confirm
// Body: { secret, id, ticker, price, tp, sl, orderType, ticket, lot, skipped, reason }
// ════════════════════════════════════════════════════════════════════
app.post("/mt5/confirm", async (req, res) => {
  const body = req.body;

  // Validasi secret
  if (!body.secret || body.secret !== MT5_SECRET) {
    console.warn("⛔ MT5 confirm secret tidak valid");
    return res.status(403).json({ error: "Unauthorized" });
  }

  const sym = normalizeSymbol(body.ticker);

  // Hapus signal dari queue setelah dikonfirmasi
  if (sym && signalQueue[sym] && signalQueue[sym].id == body.id) {
    delete signalQueue[sym];
    console.log(`🗑️ Signal ${sym} ID=${body.id} dihapus dari queue`);
  }

  // Simpan ke history
  const entry = {
    ...body,
    confirmedAt: new Date().toISOString(),
  };
  confirmHistory.unshift(entry);
  if (confirmHistory.length > 100) confirmHistory.pop(); // batasi 100 entry

  console.log(`📋 Confirm [${body.skipped ? "SKIP" : "ENTRY"}] ${sym} ID=${body.id} reason=${body.reason}`);

  // Kirim notif Telegram kalau entry berhasil
  if (!body.skipped && TELEGRAM_TOKEN && CHAT_ID) {
    try {
      const msg =
        `🤖 *EA ENTRY EXECUTED*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Pair   : *${sym}*\n` +
        `📊 Type   : *${body.orderType || "—"}*\n` +
        `💰 Price  : \`${Number(body.price || 0).toFixed(2)}\`\n` +
        `🎯 TP     : \`${Number(body.tp    || 0).toFixed(2)}\`\n` +
        `🛑 SL     : \`${Number(body.sl    || 0).toFixed(2)}\`\n` +
        `📦 Lot    : ${body.lot || "—"}\n` +
        `🎫 Ticket : \`${body.ticket || "—"}\`\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `✅ _Order tereksekusi oleh EA!_`;
      await sendTelegram(CHAT_ID, msg);
    } catch (e) {
      console.error("Telegram notify error:", e.message);
    }
  } else if (body.skipped && TELEGRAM_TOKEN && CHAT_ID) {
    // Notif skip juga (opsional — bisa di-comment kalau terlalu berisik)
    try {
      const msg =
        `⏭️ *EA SKIP SIGNAL*\n` +
        `📌 Pair  : *${sym}*\n` +
        `❓ Alasan: ${body.reason || "—"}`;
      await sendTelegram(CHAT_ID, msg);
    } catch (e) {
      console.error("Telegram skip notify error:", e.message);
    }
  }

  res.json({ ok: true, id: body.id });
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: lihat queue saat ini (debug)
// GET /mt5/queue?secret=xxx
// ════════════════════════════════════════════════════════════════════
app.get("/mt5/queue", (req, res) => {
  if (!req.query.secret || req.query.secret !== MT5_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  res.json({ queue: signalQueue, count: Object.keys(signalQueue).length });
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: lihat history konfirmasi (debug)
// GET /mt5/history?secret=xxx
// ════════════════════════════════════════════════════════════════════
app.get("/mt5/history", (req, res) => {
  if (!req.query.secret || req.query.secret !== MT5_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  res.json({ history: confirmHistory.slice(0, 20) });
});

// ════════════════════════════════════════════════════════════════════
// ROUTE: test manual
// GET /test
// ════════════════════════════════════════════════════════════════════
app.get("/test", async (req, res) => {
  try {
    await sendTelegram(CHAT_ID,
      `🤖 *BMD Signal Bot v4.0 aktif!*\n` +
      `✅ Webhook Pine Script: siap\n` +
      `✅ Endpoint MT5 polling: siap\n` +
      `✅ Telegram notif: aktif`
    );
    res.json({ ok: true, message: "Test message sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`🚀 BMD Signal Bot v4.0 running on port ${PORT}`);
  console.log(`   Webhook secret : ${WEBHOOK_SECRET ? "✅ set" : "❌ NOT SET!"}`);
  console.log(`   MT5 secret     : ${MT5_SECRET}`);
  console.log(`   Telegram token : ${TELEGRAM_TOKEN ? "✅ set" : "❌ NOT SET!"}`);
  console.log(`   Chat ID        : ${CHAT_ID || "❌ NOT SET!"}`);
});
