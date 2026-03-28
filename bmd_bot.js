// ============================================================
// BMD SIGNAL BOT — Telegram Notifier v3.0
// By: Black Market Digital Solutions
// Node.js — deploy ke Railway / Render
// ============================================================
// CHANGELOG v3.0 (update dari v2.2 — sejalan Pine v8.0):
//   ✅ FIX: 'dir'  (bukan 'direction')
//   ✅ FIX: 'sym'  (bukan 'symbol')
//   ✅ FIX: 'tf'   (bukan 'timeframe')
//   ✅ FIX: 'score' (bukan 'level'), score_max = 10 (bukan 8)
//   ✅ FIX: 'entry' single field (bukan entry1/entry2/entry3)
//   ✅ FIX: 'rame/sar/rsi/kuat/liq/fvg/msb' (bukan cond_xxx)
//   ✅ NEW: Tampilkan TP3 di pesan Telegram
//   ✅ NEW: Tampilkan HTF warning ⚠️ di pesan
//   ✅ NEW: Tampilkan session status di pesan
//   ✅ NEW: Level validasi 1–10 (bukan 3–8)
//   ✅ NEW: EARLY signal tampilkan HTF warn + session warn
//   ✅ KEEP: Health check, test endpoint, TP/SL hit handler
// ============================================================

const express = require("express");
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG — semua dari environment variable
// ─────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8771269046:AAEyeOQob2mn7r7WfIg8lsqzt1vQ-iC_5G8";
const CHAT_ID        = process.env.CHAT_ID        || "-1003823245991";
const SECRET_KEY     = process.env.WEBHOOK_SECRET || "ogifedyansyah_signal_2024";

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
// FORMAT SINYAL UTAMA — Pine v8.0 fields
// ─────────────────────────────────────────
function formatMessage(data) {
    const isEarly   = data.type === "EARLY";

    // ── Field v8.0 (nama baru) ──
    const dir       = data.dir        || "?";
    const sym       = data.sym        || "XAUUSD";
    const tf        = data.tf         || "M5";
    const score     = parseInt(data.score) || 0;
    const scoreMax  = data.score_max  || "10";
    const stars     = data.stars      || "";
    const closeVal  = data.close      || "?";
    const entry     = data.entry      || "?";
    const sl        = data.sl         || "?";
    const tp1       = data.tp1        || "?";
    const tp2       = data.tp2        || "?";
    const tp3       = data.tp3        || "?";
    const lot       = data.lot        || "?";
    const aksi      = data.aksi       || "?";
    const htf_warn  = data.htf_warn   === "1";
    const session   = data.session    === "1";
    const htf_ok    = data.htf_ok     === "1";

    // ── Kondisi checklist (nama baru tanpa cond_) ──
    const c_rame = data.rame === "1" ? "✅" : "❌";
    const c_sar  = data.sar  === "1" ? "✅" : "❌";
    const c_rsi  = data.rsi  === "1" ? "✅" : "❌";
    const c_kuat = data.kuat === "1" ? "✅" : "❌";
    const c_liq  = data.liq  === "1" ? "✅" : "❌";
    const c_fvg  = data.fvg  === "1" ? "✅" : "❌";
    const c_msb  = data.msb  === "1" ? "✅" : "❌";

    const time  = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const div   = "━━━━━━━━━━━━━━━━━━━━";
    const emoji = dir === "LONG" ? "📈🟢" : "📉🔴";

    // ── Warning lines ──
    const htfWarnLine   = htf_warn ? `⚠️ <b>HTF BERLAWANAN</b> — risiko lebih tinggi!\n` : "";
    const sessWarnLine  = !session  ? `⚠️ <b>LUAR SESSION</b> — berhati-hati!\n`          : "";
    const warnBlock     = (htfWarnLine || sessWarnLine)
        ? `${htfWarnLine}${sessWarnLine}${div}\n` : "";

    // ── Header ──
    const header = isEarly
        ? `⚡ <b>EARLY SIGNAL ${dir} [${tf}]</b> — <i>real-time</i>`
        : `${emoji} <b>CONFIRMED SIGNAL ${dir} [${tf}]</b>`;

    // ── Checklist (hanya CONFIRM) ──
    const sarLabel = dir === "LONG" ? "Bullish" : "Bearish";
    const htfLine  = htf_ok
        ? `✅ HTF Searah (${sarLabel})\n`
        : `❌ HTF ${htf_warn ? "⚠️ Berlawanan" : "Tidak Searah"}\n`;

    const condBlock = isEarly ? "" :
        `${c_rame} Pasar RAME\n` +
        `${c_sar}  SAR ${sarLabel}\n` +
        htfLine +
        `${c_rsi}  RSI Aman\n` +
        `${c_kuat} Zona KUAT\n` +
        `${c_liq}  Liquidity Sweep\n` +
        `${c_fvg}  Fair Value Gap\n` +
        `${c_msb}  MSB / BOS\n` +
        `${session ? "✅" : "⚠️"} Session ${session ? "Aktif" : "Luar Jam"}\n` +
        `${div}\n`;

    // ── TP3 line (hanya jika ada) ──
    const tp3Line = tp3 && tp3 !== "?" ? `<b>TP3     :</b> <code>${tp3}</code>  🚀 (20% hold)\n` : "";

    // ── Score color text ──
    const scoreLabel = score >= 8 ? "🚀 MAX" : score >= 6 ? "🔥 KUAT" : score >= 4 ? "✅ BAGUS" : "⚠️ LEMAH";

    return (
        `${header}\n` +
        `${div}\n` +
        `${warnBlock}` +
        `<b>Symbol :</b> ${sym} | ${tf}\n` +
        `<b>Skor   :</b> ${score} / ${scoreMax}  ${scoreLabel}\n` +
        `<b>Stars  :</b> ${stars}\n` +
        `<b>Close  :</b> <code>${closeVal}</code>\n` +
        `${div}\n` +
        `${condBlock}` +
        `<b>Entry  :</b> <code>${entry}</code>  🎯\n` +
        `${div}\n` +
        `<b>SL     :</b> <code>${sl}</code>  ⛔\n` +
        `<b>TP1    :</b> <code>${tp1}</code>  🎯 (50% close + BE)\n` +
        `<b>TP2    :</b> <code>${tp2}</code>  🏆 (30% close)\n` +
        `${tp3Line}` +
        `${div}\n` +
        `<b>LOT    :</b> ${lot}\n` +
        `<b>AKSI   :</b> <b>${aksi}</b>\n` +
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
    const label = data.type === "TP1_HIT" ? "TP1 KENA — Geser SL ke BE! ✅"
                : data.type === "TP2_HIT" ? "TP2 KENA 🏆"
                : "STOP LOSS KENA ⛔";
    const dir   = data.dir || data.direction || "?";
    const sym   = data.sym || data.symbol    || "?";
    const tf    = data.tf  || data.timeframe || "?";
    const hitLine = data.type === "SL_HIT"
        ? `<b>SL Hit  :</b> <code>${data.sl}</code>`
        : `<b>TP Hit  :</b> <code>${data.tp1 || data.tp2}</code>`;

    return (
        `${emoji} <b>${label}</b>\n` +
        `${div}\n` +
        `<b>Symbol :</b> ${sym} | ${tf}\n` +
        `<b>Arah   :</b> ${dir}\n` +
        `<b>Entry  :</b> <code>${data.entry}</code>\n` +
        `${hitLine}\n` +
        `<b>Harga  :</b> <code>${data.price || "?"}</code>\n` +
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

        // Log payload masuk
        const { key: _k, ...safeLog } = data;
        console.log("Webhook received:", JSON.stringify(safeLog));

        // Validasi secret key
        if (data.key !== SECRET_KEY) {
            console.warn("Invalid key:", data.key);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Handle TP / SL hit
        if (["TP1_HIT", "TP2_HIT", "SL_HIT"].includes(data.type)) {
            await sendTelegram(formatTpSlMessage(data));
            console.log(`${data.type} sent: ${data.dir || data.direction}`);
            return res.json({ ok: true, message: `${data.type} sent` });
        }

        // Validasi field wajib (v8.0: 'dir' dan 'entry')
        if (!data.dir || !data.entry) {
            console.warn("Missing fields:", data);
            return res.status(400).json({ error: "Missing required fields: dir, entry" });
        }

        // Validasi score — proses 3–10 untuk CONFIRM, 1+ untuk EARLY
        const score = parseInt(data.score) || 0;
        if (data.type === "CONFIRM" && score < 3) {
            console.log(`Score ${score} diabaikan (CONFIRM butuh min 3)`);
            return res.json({ ok: true, message: `Score ${score} ignored` });
        }

        // Kirim sinyal ke Telegram
        await sendTelegram(formatMessage(data));
        console.log(`[${data.type}] ${data.dir} Score ${score}/10 — ${data.sym} ${data.tf}`);
        res.json({ ok: true, message: "Signal sent!", type: data.type, score, dir: data.dir });

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
        version : "3.0",
        pine    : "v8.0 compatible",
        time    : new Date().toISOString()
    });
});

// ─────────────────────────────────────────
// TEST ENDPOINT
// ─────────────────────────────────────────
app.get("/test", async (_req, res) => {
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    await sendTelegram(
        `🧪 <b>TEST BMD SIGNAL BOT v3.0</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Bot aktif dan siap menerima sinyal!\n` +
        `Pine Script: v8.0 Smart Money Edition\n` +
        `Support: Score 1–10 | EARLY + CONFIRM\n` +
        `Checklist: 9 kondisi + HTF warn + Session\n` +
        `TP: TP1 (50%) + TP2 (30%) + TP3 (20%)\n` +
        `Waktu: ${time} WIB`
    );
    res.json({ ok: true, message: "Test message sent!", version: "3.0" });
});

// ─────────────────────────────────────────
// TEST SIGNAL — simulasi CONFIRM LONG score 7
// ─────────────────────────────────────────
app.get("/test-signal", async (_req, res) => {
    const mockPayload = {
        key       : SECRET_KEY,
        type      : "CONFIRM",
        dir       : "LONG",
        sym       : "XAUUSD",
        tf        : "M5",
        score     : "7",
        score_max : "10",
        stars     : "★★★★★★★☆☆☆",
        close     : "2345.67",
        entry     : "2344.50",
        sl        : "2340.00",
        tp1       : "2351.25",
        tp2       : "2358.00",
        tp3       : "2365.00",
        lot       : "0.10",
        htf_ok    : "1",
        htf_warn  : "0",
        session   : "1",
        rame      : "1",
        sar       : "1",
        rsi       : "1",
        kuat      : "1",
        liq       : "1",
        fvg       : "0",
        msb       : "1",
        aksi      : "🔥 ENTRY PENUH"
    };
    await sendTelegram(formatMessage(mockPayload));
    res.json({ ok: true, message: "Test CONFIRM LONG signal sent!", payload: mockPayload });
});

// Test EARLY signal
app.get("/test-early", async (_req, res) => {
    const mockPayload = {
        key      : SECRET_KEY,
        type     : "EARLY",
        dir      : "SHORT",
        sym      : "XAUUSD",
        tf       : "M5",
        score    : "3",
        stars    : "★★★☆☆☆☆☆☆☆",
        close    : "2345.67",
        entry    : "2347.00",
        sl       : "2351.00",
        tp1      : "2341.50",
        tp2      : "2336.00",
        tp3      : "2330.00",
        lot      : "0.01",
        htf_ok   : "0",
        htf_warn : "1",
        session  : "0",
        aksi     : "EARLY ENTRY"
    };
    await sendTelegram(formatMessage(mockPayload));
    res.json({ ok: true, message: "Test EARLY SHORT signal sent!", payload: mockPayload });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BMD Signal Bot v3.0 running on port ${PORT}`);
    console.log(`Pine Script: v8.0 compatible`);
    console.log(`Secret key: ${SECRET_KEY.substring(0, 6)}...`);
});
