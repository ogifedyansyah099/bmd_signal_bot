// ============================================================
// BMD SIGNAL BOT — Telegram Notifier
// By: Black Market Digital Solutions
// Node.js — deploy ke Railway / Render
// ============================================================

const express = require("express");
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8771269046:AAEyeOQob2mn7r7WfIg8lsqzt1vQ-iC_5G8";
const CHAT_ID        = process.env.CHAT_ID        || "-1003823245991";
const SECRET_KEY     = process.env.SECRET_KEY     || "ogifedyansyah_signal_2024";

// ─────────────────────────────────────────
// KIRIM PESAN KE TELEGRAM
// ─────────────────────────────────────────
async function sendTelegram(message) {
    const url  = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = { chat_id: CHAT_ID, text: message, parse_mode: "HTML" };
    try {
        const res  = await fetch(url, {
            method  : "POST",
            headers : { "Content-Type": "application/json" },
            body    : JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) console.error("Telegram error:", data);
        return data;
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// ─────────────────────────────────────────
// FORMAT SINYAL UTAMA (EARLY & CONFIRMED)
// ─────────────────────────────────────────
function formatMessage(data) {
    const isEarly = data.type === "EARLY";
    const dir     = data.direction || "?";
    const level   = data.level     || "?";
    const stars   = data.stars     || "";
    const entry1  = data.entry1    || data.entry || "?";
    const entry2  = data.entry2    || "?";
    const entry3  = data.entry3    || "?";
    const sl      = data.sl        || "?";
    const tp1     = data.tp1       || "?";
    const tp2     = data.tp2       || "?";
    const lot     = data.lot       || "?";
    const aksi    = data.aksi      || "?";
    const symbol  = data.symbol    || "XAUUSD";
    const tf      = data.timeframe || "M5";
    const rsi_val = data.rsi_val   || "";
    const time    = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const emoji   = dir === "LONG" ? "📈🟢" : "📉🔴";
    const div     = "━━━━━━━━━━━━━━━━━━━━";

    const closePrice = parseFloat(data.close) || 0;

    // Cek tiap entry — masih valid atau sudah lewat
    const checkEntry = (price) => {
        if (!closePrice || !price || price === "?") return "";
        const p = parseFloat(price);
        if (dir === "LONG")  return closePrice <= p ? " ✅" : " ⚠️ lewat";
        if (dir === "SHORT") return closePrice >= p ? " ✅" : " ⚠️ lewat";
        return "";
    };

    const e1label = dir === "LONG" ? "atas zona " : "bawah zona";
    const e2label = "tengah zona";
    const e3label = dir === "LONG" ? "bawah zona" : "atas zona ";

    const header = isEarly
        ? `⚡ <b>EARLY SIGNAL ${dir}</b> — <i>candle belum close</i>`
        : `${emoji} <b>CONFIRMED SIGNAL ${dir}</b>`;

    // Checklist kondisi hanya tampil di CONFIRMED
    const cond_rame = data.cond_rame  === "1" ? "✅" : "❌";
    const cond_sar  = data.cond_sar   === "1" ? "✅" : "❌";
    const cond_htf  = data.cond_htf   === "1" ? "✅" : "❌";
    const cond_rsi  = data.cond_rsi   === "1" ? "✅" : "❌";
    const cond_kuat = data.cond_kuat  === "1" ? "✅" : "❌";

    const condBlock = isEarly ? "" :
        `${cond_rame} Pasar RAME\n` +
        `${cond_sar}  SAR ${dir === "LONG" ? "Bullish" : "Bearish"}\n` +
        `${cond_htf}  HTF Searah\n` +
        `${cond_rsi}  RSI Aman${rsi_val ? " (" + rsi_val + ")" : ""}\n` +
        `${cond_kuat} Zona KUAT\n` +
        `${div}\n`;

    return (
        `${header}\n` +
        `${div}\n` +
        `<b>Symbol :</b> ${symbol} | ${tf}\n` +
        `<b>Level  :</b> ${level} / 8  ${stars}\n` +
        `<b>Close  :</b> <code>${data.close || "?"}</code>\n` +
        `${div}\n` +
        `${condBlock}` +
        `<b>Entry 1 :</b> <code>${entry1}</code>  (${e1label})${checkEntry(entry1)}\n` +
        `<b>Entry 2 :</b> <code>${entry2}</code>  (${e2label})${checkEntry(entry2)}\n` +
        `<b>Entry 3 :</b> <code>${entry3}</code>  (${e3label})${checkEntry(entry3)}\n` +
        `${div}\n` +
        `<b>SL      :</b> <code>${sl}</code>  ⛔\n` +
        `<b>TP1     :</b> <code>${tp1}</code>  🎯\n` +
        `<b>TP2     :</b> <code>${tp2}</code>  🏆\n` +
        `${div}\n` +
        `<b>LOT     :</b> ${lot}\n` +
        `<b>AKSI    :</b> <b>${aksi}</b>\n` +
        `${div}\n` +
        `<i>${time} WIB</i>`
    );
}

// ─────────────────────────────────────────
// FORMAT TP / SL HIT
// ─────────────────────────────────────────
function formatTpSlMessage(data) {
    const div   = "━━━━━━━━━━━━━━━━━━━━";
    const time  = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const emoji = data.type === "SL_HIT" ? "⛔" : "🎯";
    const label = data.type === "TP1_HIT" ? "TP1 KENA"
                : data.type === "TP2_HIT" ? "TP2 KENA 🏆"
                : "STOP LOSS KENA";
    const hitLine = data.type === "SL_HIT"
        ? `<b>SL Hit  :</b> <code>${data.sl}</code>`
        : `<b>TP Hit  :</b> <code>${data.tp1 || data.tp2}</code>`;

    return (
        `${emoji} <b>${label} — ${data.direction}</b>\n` +
        `${div}\n` +
        `<b>Symbol :</b> ${data.symbol} | ${data.timeframe}\n` +
        `<b>Entry  :</b> <code>${data.entry}</code>\n` +
        `${hitLine}\n` +
        `<b>Harga  :</b> <code>${data.price}</code>\n` +
        `${div}\n` +
        `<i>${time} WIB</i>`
    );
}

// ─────────────────────────────────────────
// WEBHOOK ENDPOINT
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
    try {
        const data = req.body;

        // Validasi secret key
        if (data.key !== SECRET_KEY) {
            console.log("Invalid key:", data.key);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Handle TP / SL hit
        if (data.type === "TP1_HIT" || data.type === "TP2_HIT" || data.type === "SL_HIT") {
            await sendTelegram(formatTpSlMessage(data));
            console.log(`${data.type} sent: ${data.direction}`);
            return res.json({ ok: true, message: `${data.type} sent` });
        }

        // Validasi field sinyal utama
        if (!data.direction || !data.entry1) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Kirim sinyal (EARLY atau CONFIRMED)
        await sendTelegram(formatMessage(data));
        console.log(`[${data.type || "SIGNAL"}] ${data.direction} Level ${data.level}`);
        res.json({ ok: true, message: "Signal sent to Telegram" });

    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/", (_req, res) => {
    res.json({ status: "BMD Signal Bot is running", version: "2.0", time: new Date().toISOString() });
});

// Test endpoint
app.get("/test", async (_req, res) => {
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    await sendTelegram(`🧪 <b>TEST BMD SIGNAL BOT</b>\n━━━━━━━━━━━━━━━━━━━━\nBot aktif dan siap menerima sinyal!\nWaktu: ${time} WIB`);
    res.json({ ok: true, message: "Test message sent!" });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BMD Signal Bot running on port ${PORT}`);
});
