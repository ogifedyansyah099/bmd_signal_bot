// ============================================================
// BMD SIGNAL BOT — Telegram Notifier v2.2
// By: Black Market Digital Solutions
// Node.js — deploy ke Railway / Render
// ============================================================
// CHANGELOG v2.2:
//   ✅ Support 8 kondisi checklist (+ cond_liq, cond_fvg, cond_msb)
//   ✅ Level tampil sebagai X/8 (bukan X/5)
//   ✅ Field "close" ditampilkan di pesan
//   ✅ SECRET_KEY default sejalan dengan Pine Script
//   ✅ Token & CHAT_ID tetap dari env variable (lebih aman)
// ============================================================

const express = require("express");
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG — semua dari environment variable
// Fallback hardcoded HANYA untuk development lokal
// ─────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN  || "8771269046:AAEyeOQob2mn7r7WfIg8lsqzt1vQ-iC_5G8";
const CHAT_ID        = process.env.CHAT_ID         || "-1003823245991";
// ⚠️  Railway variable namanya WEBHOOK_SECRET — harus sama persis
const SECRET_KEY     = process.env.WEBHOOK_SECRET  || "ogifedyansyah_signal_2024";

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
// FORMAT SINYAL UTAMA
// Mendukung 8 kondisi checklist (sejalan Pine v7.1)
// ─────────────────────────────────────────
function formatMessage(data) {
    const isEarly  = data.type === "EARLY";
    const dir      = data.direction || "?";
    const level    = parseInt(data.level) || 0;
    const levelMax = data.level_max || "8";
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
    const rsi_val  = data.rsi_val   || "";
    const closeVal = data.close     || "?";
    const time     = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const emoji = dir === "LONG" ? "📈🟢" : "📉🔴";
    const div   = "━━━━━━━━━━━━━━━━━━━━";

    // Cek tiap entry — masih valid atau sudah lewat
    const closePrice = parseFloat(data.close) || 0;
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

    // Checklist 8 kondisi — hanya tampil di CONFIRMED
    const cond_rame = data.cond_rame === "1" ? "✅" : "❌";
    const cond_sar  = data.cond_sar  === "1" ? "✅" : "❌";
    const cond_htf  = data.cond_htf  === "1" ? "✅" : "❌";
    const cond_rsi  = data.cond_rsi  === "1" ? "✅" : "❌";
    const cond_kuat = data.cond_kuat === "1" ? "✅" : "❌";
    const cond_liq  = data.cond_liq  === "1" ? "✅" : "❌";
    const cond_fvg  = data.cond_fvg  === "1" ? "✅" : "❌";
    const cond_msb  = data.cond_msb  === "1" ? "✅" : "❌";

    const sarLabel = dir === "LONG" ? "Bullish" : "Bearish";
    const htfLabel = dir === "LONG" ? "Bullish" : "Bearish";

    const condBlock = isEarly ? "" :
        `${cond_rame} Pasar RAME\n` +
        `${cond_sar}  SAR ${sarLabel}\n` +
        `${cond_htf}  HTF Searah (${htfLabel})\n` +
        `${cond_rsi}  RSI Aman${rsi_val ? " (" + rsi_val + ")" : ""}\n` +
        `${cond_kuat} Zona KUAT\n` +
        `${cond_liq}  Liquidity Sweep\n` +
        `${cond_fvg}  Fair Value Gap\n` +
        `${cond_msb}  MSB Konfirmasi\n` +
        `${div}\n`;

    return (
        `${header}\n` +
        `${div}\n` +
        `<b>Symbol :</b> ${symbol} | ${tf}\n` +
        `<b>Level  :</b> ${level} / ${levelMax}  ${stars}\n` +
        `<b>Close  :</b> <code>${closeVal}</code>\n` +
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

        // Log payload masuk (tanpa key untuk keamanan)
        const { key: _k, ...safeLog } = data;
        console.log("Webhook received:", JSON.stringify(safeLog));

        // Validasi secret key
        if (data.key !== SECRET_KEY) {
            console.warn("Invalid key attempt:", data.key);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Handle TP / SL hit
        if (["TP1_HIT", "TP2_HIT", "SL_HIT"].includes(data.type)) {
            await sendTelegram(formatTpSlMessage(data));
            console.log(`${data.type} sent: ${data.direction}`);
            return res.json({ ok: true, message: `${data.type} sent` });
        }

        // Validasi field sinyal utama
        if (!data.direction || !data.entry1) {
            console.warn("Missing fields:", data);
            return res.status(400).json({ error: "Missing required fields: direction, entry1" });
        }

        // Validasi level — hanya proses 3–8
        const level = parseInt(data.level) || 0;
        if (level < 3 || level > 8) {
            console.log(`Level ${level} diabaikan (di luar 3–8)`);
            return res.json({ ok: true, message: `Level ${level} ignored (below minimum)` });
        }

        // Kirim sinyal ke Telegram
        await sendTelegram(formatMessage(data));
        console.log(`[SIGNAL] ${data.direction} Level ${level}/8 — ${data.symbol} ${data.timeframe}`);
        res.json({ ok: true, message: "Signal sent to Telegram", level });

    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/", (_req, res) => {
    res.json({
        status  : "BMD Signal Bot is running",
        version : "2.2",
        time    : new Date().toISOString()
    });
});

// Test endpoint — kirim pesan dummy ke Telegram
app.get("/test", async (_req, res) => {
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    await sendTelegram(
        `🧪 <b>TEST BMD SIGNAL BOT v2.2</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Bot aktif dan siap menerima sinyal!\n` +
        `Support: Level 3–8 / 8 bintang\n` +
        `Checklist: 8 kondisi (termasuk LIQ, FVG, MSB)\n` +
        `Waktu: ${time} WIB`
    );
    res.json({ ok: true, message: "Test message sent!" });
});

// Test webhook payload — simulasi sinyal LONG level 5
app.get("/test-signal", async (_req, res) => {
    const mockPayload = {
        key       : SECRET_KEY,
        direction : "LONG",
        symbol    : "XAUUSD",
        timeframe : "M5",
        level     : "5",
        level_max : "8",
        stars     : "★★★★★☆☆☆",
        close     : "2345.67",
        entry1    : "2347.00",
        entry2    : "2345.50",
        entry3    : "2344.00",
        sl        : "2341.00",
        tp1       : "2351.00",
        tp2       : "2358.00",
        lot       : "0.10",
        aksi      : "ENTRY PENUH",
        rsi_val   : "55",
        cond_rame : "1",
        cond_sar  : "1",
        cond_htf  : "1",
        cond_rsi  : "1",
        cond_kuat : "0",
        cond_liq  : "1",
        cond_fvg  : "0",
        cond_msb  : "1"
    };
    await sendTelegram(formatMessage(mockPayload));
    res.json({ ok: true, message: "Test signal sent!", payload: mockPayload });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BMD Signal Bot v2.2 running on port ${PORT}`);
    console.log(`Secret key (WEBHOOK_SECRET): ${SECRET_KEY.substring(0, 6)}...`);
});
