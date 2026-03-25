// ============================================================
// BMD SIGNAL BOT — Telegram Notifier
// By: Black Market Digital Solutions
// Node.js — deploy ke Railway / Render (gratis)
// ============================================================
// CARA PAKAI:
//   1. Isi TELEGRAM_TOKEN dan CHAT_ID di bawah
//   2. Deploy ke Railway.app (gratis)
//   3. Pakai URL webhook di TradingView Alert
// ============================================================

const express = require("express");
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG — isi dengan data kamu
// ─────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8771269046:AAEyeOQob2mn7r7WfIg8lsqzt1vQ-iC_5G8";
const CHAT_ID        = process.env.CHAT_ID        || "-1003823245991";
const SECRET_KEY     = process.env.SECRET_KEY     || "ogifedyansyah_signal_2024";
// SECRET_KEY = password supaya hanya TradingView yang bisa kirim

// ─────────────────────────────────────────
// KIRIM PESAN KE TELEGRAM
// ─────────────────────────────────────────
async function sendTelegram(message) {
    const url  = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = {
        chat_id    : CHAT_ID,
        text       : message,
        parse_mode : "HTML"
    };

    try {
        const res = await fetch(url, {
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
// FORMAT PESAN BERDASARKAN TIPE SINYAL
// ─────────────────────────────────────────
function formatMessage(data) {
    const dir      = data.direction || "?";
    const level    = data.level     || "?";
    const stars    = data.stars     || "";
    const entry1   = data.entry1    || data.entry || "?";
    const entry2   = data.entry2    || "?";
    const entry3   = data.entry3    || "?";
    const sl       = data.sl        || "?";
    const tp1      = data.tp1       || "?";
    const tp2      = data.tp2       || "?";
    const lot      = data.lot       || "?";
    const aksi     = data.aksi      || "?";
    const symbol   = data.symbol    || "XAUUSD";
    const tf       = data.timeframe || "M5";
    const time     = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const emoji    = dir === "LONG" ? "📈🟢" : "📉🔴";
    const divider  = "━━━━━━━━━━━━━━━━━━━━";

    const cond_rame  = data.cond_rame  === "1" ? "✅" : "❌";
    const cond_sar   = data.cond_sar   === "1" ? "✅" : "❌";
    const cond_htf   = data.cond_htf   === "1" ? "✅" : "❌";
    const cond_rsi   = data.cond_rsi   === "1" ? "✅" : "❌";
    const cond_kuat  = data.cond_kuat  === "1" ? "✅" : "❌";
    const rsi_val    = data.rsi_val    || "";

    // Label entry sesuai arah
    const e1label = dir === "LONG" ? "atas zona " : "bawah zona";
    const e2label = "tengah zona";
    const e3label = dir === "LONG" ? "bawah zona" : "atas zona ";

    const msg =
`${emoji} <b>TRIPLE CONFLUENCE ${dir}</b>
${divider}
<b>Symbol :</b> ${symbol} | ${tf}
<b>Level  :</b> ${level} / 5  ${stars}
${divider}
${cond_rame} Pasar RAME
${cond_sar}  SAR ${dir === "LONG" ? "Bullish" : "Bearish"}
${cond_htf}  HTF Searah
${cond_rsi}  RSI Aman${rsi_val ? " (" + rsi_val + ")" : ""}
${cond_kuat} Zona KUAT
${divider}
<b>Entry 1 :</b> <code>${entry1}</code>  (${e1label})
<b>Entry 2 :</b> <code>${entry2}</code>  (${e2label})
<b>Entry 3 :</b> <code>${entry3}</code>  (${e3label})
${divider}
<b>SL      :</b> <code>${sl}</code>  ⛔
<b>TP1     :</b> <code>${tp1}</code>  🎯
<b>TP2     :</b> <code>${tp2}</code>  🏆
${divider}
<b>LOT     :</b> ${lot}
<b>AKSI    :</b> <b>${aksi}</b>
${divider}
<i>${time} WIB</i>`;

    return msg;
}

// ─────────────────────────────────────────
// WEBHOOK ENDPOINT — TradingView kirim ke sini
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
    try {
        const data = req.body;

        // Validasi secret key
        if (data.key !== SECRET_KEY) {
            console.log("Invalid key:", data.key);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Hanya proses sinyal Triple Confluence
        if (!data.direction || !data.entry) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Format dan kirim ke Telegram
        const message = formatMessage(data);
        await sendTelegram(message);

        console.log(`Signal sent: ${data.direction} Level ${data.level}`);
        res.json({ ok: true, message: "Signal sent to Telegram" });

    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

// ─────────────────────────────────────────
// HEALTH CHECK — cek apakah bot hidup
// ─────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({
        status  : "BMD Signal Bot is running",
        version : "1.0",
        time    : new Date().toISOString()
    });
});

// Test endpoint — kirim test message ke Telegram
app.get("/test", async (req, res) => {
    const testMsg = 
`🧪 <b>TEST BMD SIGNAL BOT</b>
━━━━━━━━━━━━━━━━━━━━
Bot aktif dan siap menerima sinyal!
Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

    await sendTelegram(testMsg);
    res.json({ ok: true, message: "Test message sent!" });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BMD Signal Bot running on port ${PORT}`);
});
