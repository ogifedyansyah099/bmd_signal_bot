// ============================================================
// BMD SIGNAL BOT — Telegram Notifier v3.4
// By: Black Market Digital Solutions
// Node.js — deploy ke Railway / Render
// ============================================================
// CHANGELOG v3.4 (update dari v3.3 — sejalan Pine v8.2):
//   ✅ FIX: Early Signal skor < 5 tidak dikirim ke Telegram
//   ✅ REMOVE: ZONE_INVALID dihapus (cegah spam grup)
// CHANGELOG v3.3 (update dari v3.2 — sejalan Pine v8.2 Forex):
//   ✅ NEW: Handler TP3_HIT — notif full exit ke Telegram
//   ✅ FIX: hitLine sekarang handle TP1/TP2/TP3/SL masing-masing
//   ✅ NEW: TP3 reminder "Semua posisi tertutup" di pesan
// ============================================================

const express = require("express");
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG
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
// HELPERS
// ─────────────────────────────────────────
function obTierEmoji(tier) {
    if (tier === "FRESH")     return "🔥";
    if (tier === "MITIGATED") return "⚡";
    if (tier === "WEAK")      return "💀";
    return "";
}

function scoreLabel(score) {
    if (score >= 8) return "🚀 MAX";
    if (score >= 6) return "🔥 KUAT";
    if (score >= 4) return "✅ BAGUS";
    return "⚠️ LEMAH";
}

// ─────────────────────────────────────────
// FORMAT SINYAL UTAMA
// ─────────────────────────────────────────
function fmtLot(val) {
    if (!val || val === "?") return "?";
    return parseFloat(val).toString();
}

function formatMessage(data) {
    const isEarly  = data.type === "EARLY";
    const dir      = data.dir       || "?";
    const sym      = data.sym       || "XAUUSD";
    const tf       = data.tf        || "M5";
    const score    = parseInt(data.score) || 0;
    const scoreMax = data.score_max || "10";
    const stars    = data.stars     || "";
    const closeVal = data.close     || "?";
    const entry    = data.entry     || "?";
    const sl       = data.sl        || "?";
    const tp1      = data.tp1       || "?";
    const tp2      = data.tp2       || "?";
    const tp3      = data.tp3       || "?";
    const lot      = fmtLot(data.lot);
    const aksi     = data.aksi      || "?";
    const htf_warn = data.htf_warn  === "1";
    const session  = data.session   === "1";
    const htf_ok   = data.htf_ok    === "1";
    const hpm      = data.hpm       === "1";
    const ob_tier  = data.ob_tier   || "";
    const ob_touch = data.ob_touch  || "0";

    // Kondisi checklist
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

    // Warning block
    const htfWarnLine  = htf_warn ? `⚠️ <b>HTF BERLAWANAN</b> — risiko lebih tinggi!\n` : "";
    const sessWarnLine = !session  ? `⚠️ <b>LUAR SESSION</b> — berhati-hati!\n`          : "";
    const warnBlock    = (htfWarnLine || sessWarnLine)
        ? `${htfWarnLine}${sessWarnLine}${div}\n` : "";

    // HPM badge
    const hpmBadge = hpm ? ` 🔥<b>HPM</b>` : "";

    // Header
    const header = isEarly
        ? `⚡ <b>EARLY SIGNAL ${dir} [${tf}]</b>${hpmBadge} — <i>real-time</i>`
        : `💪 <b>KONFIRMASI SIGNAL ${dir} [${tf}]</b>${hpmBadge}`;

    // Confirm message block
    const condBlock = isEarly ? "" :
        `Sudah entry di EARLY? → Pertahankan! 🔒\n` +
        `Belum entry? → Bisa entry sekarang 🎯\n` +
        `${div}\n`;

    // OB Tier line
    const obLine = ob_tier
        ? `<b>OB Zone:</b> ${obTierEmoji(ob_tier)} ${ob_tier}  (${ob_touch}x touch)\n`
        : "";

    // TP3
    const tp3Line = tp3 && tp3 !== "?"
        ? `<b>TP3    :</b> <code>${tp3}</code>  🚀 (20% hold)\n` : "";

    return (
        `${header}\n` +
        `${div}\n` +
        `${warnBlock}` +
        `<b>Symbol :</b> ${sym} | ${tf}\n` +
        `<b>Skor   :</b> ${score} / ${scoreMax}  ${scoreLabel(score)}\n` +
        `<b>Stars  :</b> ${stars}\n` +
        `<b>Close  :</b> <code>${closeVal}</code>\n` +
        `${obLine}` +
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
        (!isEarly ? `${div}\nHarga masih berjalan — semoga kena TP! 💰\n` : `<b>AKSI   :</b> <b>${aksi}</b>\n`) +
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
    const label = data.type === "TP1_HIT" ? "🎯 TP1 KENA"
                : data.type === "TP2_HIT" ? "🏆 TP2 KENA"
                : data.type === "TP3_HIT" ? "🚀 TP3 KENA — FULL EXIT"
                : "⛔ STOP LOSS KENA";
    const dir  = data.dir || data.direction || "?";
    const sym  = data.sym || data.symbol    || "?";
    const tf   = data.tf  || data.timeframe || "?";
    const hitLine = data.type === "SL_HIT"  ? `<b>SL Hit  :</b> <code>${data.sl}</code>`
                  : data.type === "TP1_HIT" ? `<b>TP Hit  :</b> <code>${data.tp1}</code>`
                  : data.type === "TP2_HIT" ? `<b>TP Hit  :</b> <code>${data.tp2}</code>`
                  : `<b>TP Hit  :</b> <code>${data.tp3}</code>`;
    const beReminder = data.type === "TP1_HIT"
        ? `${div}\n💡 <b>Segera geser SL ke harga Entry!</b>\n🔒 Posisi jadi Zero Risk\n` : "";
    const tp3Reminder = data.type === "TP3_HIT"
        ? `${div}\n🏁 <b>Semua posisi sudah tertutup!</b>\n💰 Booking profit penuh — tunggu setup berikutnya\n` : "";

    return (
        `${label}\n` +
        `${div}\n` +
        `<b>Symbol :</b> ${sym} | ${tf}\n` +
        `<b>Arah   :</b> ${dir}\n` +
        `<b>Entry  :</b> <code>${data.entry}</code>\n` +
        `${hitLine}\n` +
        `<b>Harga  :</b> <code>${data.price || "?"}</code>\n` +
        `${beReminder}` +
        `${tp3Reminder}` +
        `${div}\n` +
        `<i>${time} WIB</i>`
    );
}

// ─────────────────────────────────────────
// FORMAT LONDON OPEN STATUS
// ─────────────────────────────────────────
function formatLondonStatus(data) {
    const div  = "━━━━━━━━━━━━━━━━━━━━";
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    // Map market string → emoji label
    const marketMap = { "RAME": "✅ RAME", "SEPI": "💤 SEPI", "NORMAL": "🔄 NORMAL" };
    const marketLabel = marketMap[data.market] || data.market || "🔄 NORMAL";

    // Map htf_dir string → emoji label
    const htfMap = { "Bullish": "📈 Bullish", "Bearish": "📉 Bearish" };
    const htfLabel = htfMap[data.htf_dir] || data.htf_dir || "?";

    return (
        `📊 <b>STATUS SIGNAL HARI INI</b>\n` +
        `${div}\n` +
        `<b>Mode    :</b> ${data.hpm === "1" ? "🔥 High Probability" : "⚡ Normal"}\n` +
        `<b>Market  :</b> ${marketLabel}\n` +
        `<b>HTF     :</b> ${htfLabel}\n` +
        `<b>OB Zone :</b> ${data.ob_ada === "1" ? "✅ Ada" : "❌ Belum ada"}\n` +
        `<b>Session :</b> London Open 🇬🇧\n` +
        `${div}\n` +
        `💪 Sabar = profit terjaga\n` +
        `👍 No trade juga posisi yang bagus\n` +
        `<i>${time} WIB</i>`
    );
}

// ─────────────────────────────────────────
// WEBHOOK ENDPOINT
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
    try {
        const data = req.body;
        const { key: _k, ...safeLog } = data;
        console.log("Webhook received:", JSON.stringify(safeLog));

        // Validasi key
        if (data.key !== SECRET_KEY) {
            console.warn("Invalid key:", data.key);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // ── London Open Status ──
        if (data.type === "LONDON_STATUS") {
            await sendTelegram(formatLondonStatus(data));
            return res.json({ ok: true, message: "London status sent" });
        }

        // ── TP / SL Hit ──
        if (["TP1_HIT", "TP2_HIT", "TP3_HIT", "SL_HIT"].includes(data.type)) {
            await sendTelegram(formatTpSlMessage(data));
            return res.json({ ok: true, message: `${data.type} sent` });
        }

        // ── Validasi field wajib ──
        if (!data.dir || !data.entry) {
            return res.status(400).json({ error: "Missing required fields: dir, entry" });
        }

        // ── Validasi score ──
        const score = parseInt(data.score) || 0;
        if (data.type === "CONFIRM" && score < 5) {
            return res.json({ ok: true, message: `Score ${score} ignored (min 5)` });
        }

        // ── Block OB WEAK saat HPM ON ──
        if (data.hpm === "1" && data.ob_tier === "WEAK") {
            console.log("OB WEAK diblokir — HPM ON");
            return res.json({ ok: true, message: "OB WEAK ignored in HPM mode" });
        }

        // ── Kirim signal ──
        await sendTelegram(formatMessage(data));
        console.log(`[${data.type}] ${data.dir} ${score}/10 OB:${data.ob_tier || "?"} HPM:${data.hpm} — ${data.sym} ${data.tf}`);
        res.json({ ok: true, message: "Signal sent!", type: data.type, score, ob_tier: data.ob_tier });

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
        status   : "BMD Signal Bot is running",
        version  : "3.4",
        pine     : "v8.2 compatible",
        features : ["EARLY (skor≥5)", "CONFIRM (skor≥5)", "HPM", "OB_TIER", "LONDON_STATUS", "TP1_HIT", "TP2_HIT", "TP3_HIT", "SL_HIT"],
        time     : new Date().toISOString()
    });
});

// ─────────────────────────────────────────
// TEST ENDPOINTS
// ─────────────────────────────────────────
app.get("/test", async (_req, res) => {
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    await sendTelegram(
        `🧪 <b>TEST BMD SIGNAL BOT v3.4</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Pine Script : v8.2 Edition\n` +
        `Score       : Min 5/10 | EARLY + CONFIRM\n` +
        `OB Tier     : 🔥FRESH / ⚡MITIGATED / 💀WEAK\n` +
        `HPM Mode    : 🔥 High Probability Toggle\n` +
        `TP Split    : TP1(50%) + TP2(30%) + TP3(20%)\n` +
        `TP3 Notif   : ✅ Aktif (Full Exit Alert)\n` +
        `Multi-trade : ✅ Max 3 concurrent\n` +
        `Zone Invalid: ❌ Dinonaktifkan (anti spam)\n` +
        `Waktu       : ${time} WIB`
    );
    res.json({ ok: true, message: "Test sent!", version: "3.4" });
});

app.get("/test-signal", async (_req, res) => {
    const mock = {
        key:"", type:"CONFIRM", dir:"LONG", sym:"XAUUSD", tf:"M5",
        score:"7", score_max:"10", stars:"★★★★★★★☆☆☆",
        close:"2345.67", entry:"2344.50", sl:"2340.00",
        tp1:"2351.25", tp2:"2358.00", tp3:"2365.00", lot:"0.10",
        htf_ok:"1", htf_warn:"0", session:"1",
        rame:"1", sar:"1", rsi:"1", kuat:"1", liq:"1", fvg:"0", msb:"1",
        ob_tier:"FRESH", ob_touch:"0", hpm:"1", aksi:"🔥 ENTRY PENUH"
    };
    mock.key = SECRET_KEY;
    await sendTelegram(formatMessage(mock));
    res.json({ ok: true, message: "Test CONFIRM LONG HPM + OB FRESH sent!" });
});

app.get("/test-early", async (_req, res) => {
    const mock = {
        key:"", type:"EARLY", dir:"SHORT", sym:"XAUUSD", tf:"M5",
        score:"3", stars:"★★★☆☆☆☆☆☆☆",
        close:"2345.67", entry:"2347.00", sl:"2351.00",
        tp1:"2341.50", tp2:"2336.00", tp3:"2330.00", lot:"0.01",
        htf_ok:"0", htf_warn:"1", session:"0",
        ob_tier:"MITIGATED", ob_touch:"2", hpm:"0", aksi:"EARLY ENTRY"
    };
    mock.key = SECRET_KEY;
    await sendTelegram(formatMessage(mock));
    res.json({ ok: true, message: "Test EARLY SHORT + HTF warn + MITIGATED sent!" });
});

app.get("/test-london", async (_req, res) => {
    const mock = { key: SECRET_KEY, type:"LONDON_STATUS", hpm:"1", market:"NORMAL", htf_dir:"Bullish", ob_ada:"1" };
    await sendTelegram(formatLondonStatus(mock));
    res.json({ ok: true, message: "Test London status sent!" });
});

app.get("/test-tp3", async (_req, res) => {
    const mock = {
        key: SECRET_KEY, type: "TP3_HIT", dir: "LONG",
        sym: "XAUUSD", tf: "M5",
        entry: "2344.50", tp3: "2365.00", price: "2365.20"
    };
    await sendTelegram(formatTpSlMessage(mock));
    res.json({ ok: true, message: "Test TP3 HIT sent!" });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BMD Signal Bot v3.4 running on port ${PORT}`);
    console.log(`Pine: v8.2 compatible`);
    console.log(`Secret key: ${SECRET_KEY.substring(0, 6)}...`);
});
