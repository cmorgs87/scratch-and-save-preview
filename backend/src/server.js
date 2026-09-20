"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const crossword_1 = require("./crossword");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = Number(process.env.PORT || 4100);
const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3101";
const FREE_PLAY_TICKET_ID = "gold";
const TICKET_ORDER = [FREE_PLAY_TICKET_ID];
const ALLOWED_ORIGINS = new Set([
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3101",
]);
const COOKIE_OPTIONS = {
    httpOnly: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: IS_PROD ? "none" : "lax",
    secure: IS_PROD,
};
const COOKIE_CLEAR_OPTIONS = {
    httpOnly: true,
    path: "/",
    sameSite: IS_PROD ? "none" : "lax",
    secure: IS_PROD,
};
const DEFAULT_SIGNUP_BONUS = "100";
const DEFAULT_DAILY_REWARD = "25";
const DEFAULT_SCRATCH_CONFIG = JSON.stringify({
    bronze: { cost: 10, payouts: [{ amount: 0, weight: 70 }, { amount: 5, weight: 20 }, { amount: 10, weight: 9 }, { amount: 25, weight: 1 }] },
    silver: { cost: 20, payouts: [{ amount: 0, weight: 65 }, { amount: 10, weight: 22 }, { amount: 20, weight: 11 }, { amount: 50, weight: 2 }] },
    gold: { cost: 50, payouts: [{ amount: 0, weight: 60 }, { amount: 25, weight: 25 }, { amount: 50, weight: 12 }, { amount: 150, weight: 3 }] },
});
const LEGACY_TRIPLE_CROWN_DERBY_CONFIG = DEFAULT_SCRATCH_CONFIG;
const PREVIOUS_TRIPLE_CROWN_DERBY_CONFIG = JSON.stringify({
    bronze: { cost: 10, payouts: [{ amount: 0, weight: 70 }, { amount: 15, weight: 20 }, { amount: 30, weight: 9 }, { amount: 75, weight: 1 }] },
    silver: { cost: 20, payouts: [{ amount: 0, weight: 65 }, { amount: 30, weight: 22 }, { amount: 60, weight: 11 }, { amount: 150, weight: 2 }] },
    gold: { cost: 50, payouts: [{ amount: 0, weight: 60 }, { amount: 75, weight: 25 }, { amount: 150, weight: 12 }, { amount: 450, weight: 3 }] },
});
const DEFAULT_TRIPLE_CROWN_DERBY_CONFIG = JSON.stringify({
    bronze: {
        cost: 10,
        payouts: [
            { amount: 0, weight: 70 },
            { amount: 15, weight: 16 },
            { amount: 30, weight: 7 },
            { amount: 90, weight: 4 },
            { amount: 150, weight: 2 },
            { amount: 225, weight: 1 },
        ],
    },
    silver: {
        cost: 20,
        payouts: [
            { amount: 0, weight: 65 },
            { amount: 30, weight: 17 },
            { amount: 60, weight: 8 },
            { amount: 180, weight: 5 },
            { amount: 300, weight: 3 },
            { amount: 450, weight: 2 },
        ],
    },
    gold: {
        cost: 50,
        payouts: [
            { amount: 0, weight: 60 },
            { amount: 75, weight: 18 },
            { amount: 150, weight: 10 },
            { amount: 450, weight: 6 },
            { amount: 900, weight: 4 },
            { amount: 1350, weight: 2 },
        ],
    },
});
const DEFAULT_THE_BIG_SCORE_CONFIG = JSON.stringify({
    bronze: {
        cost: 10,
        payouts: [{ amount: 0, weight: 55 }, { amount: 5, weight: 25 }, { amount: 10, weight: 15 }, { amount: 25, weight: 5 }],
    },
    silver: {
        cost: 20,
        payouts: [{ amount: 0, weight: 50 }, { amount: 10, weight: 25 }, { amount: 20, weight: 18 }, { amount: 50, weight: 7 }],
    },
    gold: {
        cost: 50,
        payouts: [{ amount: 0, weight: 45 }, { amount: 25, weight: 28 }, { amount: 50, weight: 19 }, { amount: 150, weight: 8 }],
    },
});
const LEGACY_CROSSWORD_CONFIG = DEFAULT_SCRATCH_CONFIG;
const DEFAULT_CROSSWORD_CONFIG = JSON.stringify({
    bronze: {
        cost: 10,
        payouts: [
            { amount: 0, weight: 700 },
            { amount: 10, weight: 120 },
            { amount: 20, weight: 60 },
            { amount: 40, weight: 35 },
            { amount: 75, weight: 25 },
            { amount: 150, weight: 15 },
            { amount: 300, weight: 8 },
            { amount: 600, weight: 5 },
            { amount: 1200, weight: 2 },
            { amount: 2500, weight: 1 },
        ],
    },
    silver: {
        cost: 20,
        payouts: [
            { amount: 0, weight: 650 },
            { amount: 20, weight: 120 },
            { amount: 40, weight: 70 },
            { amount: 80, weight: 50 },
            { amount: 160, weight: 35 },
            { amount: 320, weight: 20 },
            { amount: 640, weight: 12 },
            { amount: 1250, weight: 6 },
            { amount: 2500, weight: 3 },
            { amount: 5000, weight: 1 },
        ],
    },
    gold: {
        cost: 50,
        payouts: [
            { amount: 0, weight: 600 },
            { amount: 50, weight: 130 },
            { amount: 100, weight: 80 },
            { amount: 250, weight: 55 },
            { amount: 500, weight: 40 },
            { amount: 1000, weight: 24 },
            { amount: 2500, weight: 14 },
            { amount: 5000, weight: 8 },
            { amount: 10000, weight: 4 },
            { amount: 25000, weight: 1 },
        ],
    },
});
app.set("trust proxy", 1);
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.has(origin))
            return cb(null, true);
        return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "256kb" }));
app.use((0, cookie_parser_1.default)());
app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS")
        return next();
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.has(origin))
        return next();
    return res.status(403).json({ ok: false, error: "Blocked by origin policy" });
});
const loginHits = new Map();
function loginRateLimit(req, res, next) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    const windowMs = 60000;
    const max = 20;
    const prev = loginHits.get(ip);
    if (!prev || now > prev.resetAt) {
        loginHits.set(ip, { count: 1, resetAt: now + windowMs });
        return next();
    }
    prev.count += 1;
    if (prev.count > max) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((prev.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: "Too many requests. Try again later." });
    }
    return next();
}
function requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET not set on server");
    return secret;
}
function signSession(userId) {
    return jsonwebtoken_1.default.sign({ userId }, requireJwtSecret(), { expiresIn: "7d" });
}
function readSession(req) {
    const token = req.cookies?.session;
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, requireJwtSecret());
        return payload.userId ?? null;
    }
    catch {
        return null;
    }
}
function requireAuth(req, res) {
    const userId = readSession(req);
    if (!userId) {
        res.status(401).json({ ok: false, error: "Not logged in" });
        return null;
    }
    return userId;
}
async function getConfig(key, fallback) {
    const row = await prisma.appConfig.findUnique({ where: { key } });
    return row?.value ?? fallback;
}
async function setConfig(key, value) {
    await prisma.appConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    });
}
async function logLedgerSafe(tx, userId, kind, delta, balance, meta) {
    await tx.ledgerEntry.create({
        data: {
            userId,
            kind,
            delta,
            balance,
            metaJson: meta ? JSON.stringify(meta) : null,
        },
    });
}
async function adjustCoinsAtomic(args) {
    const { userId, delta, kind, meta } = args;
    return prisma.$transaction(async (tx) => {
        if (delta < 0) {
            const spend = -delta;
            const updated = await tx.user.updateMany({
                where: { id: userId, scratchCoin: { gte: spend } },
                data: { scratchCoin: { decrement: spend } },
            });
            if (updated.count !== 1)
                return { ok: false, error: "Not enough Scratch Coin" };
        }
        if (delta > 0) {
            await tx.user.update({ where: { id: userId }, data: { scratchCoin: { increment: delta } } });
        }
        const user = await tx.user.findUnique({ where: { id: userId }, select: { scratchCoin: true } });
        if (!user)
            return { ok: false, error: "Not logged in" };
        await logLedgerSafe(tx, userId, kind, delta, user.scratchCoin, meta);
        return { ok: true, scratchCoin: user.scratchCoin };
    });
}
async function getScratchCoinBalance(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { scratchCoin: true },
    });
    return user?.scratchCoin ?? 0;
}
function getFreePlayTicketConfig(config) {
    return config[FREE_PLAY_TICKET_ID] ?? config.gold;
}
async function ensureConfigSeeded() {
    const entries = [
        ["signup_bonus", DEFAULT_SIGNUP_BONUS],
        ["daily_reward", DEFAULT_DAILY_REWARD],
        ["scratch_config", DEFAULT_SCRATCH_CONFIG],
        ["the_big_score_config", DEFAULT_THE_BIG_SCORE_CONFIG],
        ["triple_crown_derby_config", DEFAULT_TRIPLE_CROWN_DERBY_CONFIG],
        ["crossword_config", DEFAULT_CROSSWORD_CONFIG],
    ];
    for (const [key, value] of entries) {
        const existing = await prisma.appConfig.findUnique({ where: { key } });
        if (!existing)
            await setConfig(key, value);
    }
    const crosswordConfig = await prisma.appConfig.findUnique({ where: { key: "crossword_config" } });
    if (crosswordConfig?.value === LEGACY_CROSSWORD_CONFIG) {
        await setConfig("crossword_config", DEFAULT_CROSSWORD_CONFIG);
    }
    const tripleCrownDerbyConfig = await prisma.appConfig.findUnique({ where: { key: "triple_crown_derby_config" } });
    if (tripleCrownDerbyConfig?.value === LEGACY_TRIPLE_CROWN_DERBY_CONFIG ||
        tripleCrownDerbyConfig?.value === PREVIOUS_TRIPLE_CROWN_DERBY_CONFIG) {
        await setConfig("triple_crown_derby_config", DEFAULT_TRIPLE_CROWN_DERBY_CONFIG);
    }
}
const SignupBody = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const LoginBody = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const PlayScratchBody = zod_1.z.object({
    ticketId: zod_1.z.enum(["bronze", "silver", "gold"]),
});
const StartCrosswordBody = zod_1.z.object({
    ticketId: zod_1.z.enum(["bronze", "silver", "gold"]),
});
const ClaimCrosswordBody = zod_1.z.object({
    sessionId: zod_1.z.string().min(1),
});
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
app.get("/config/public", async (_req, res) => {
    const dailyReward = Number(await getConfig("daily_reward", DEFAULT_DAILY_REWARD)) || 25;
    const signupBonus = Number(await getConfig("signup_bonus", DEFAULT_SIGNUP_BONUS)) || 100;
    res.json({ ok: true, dailyReward, signupBonus });
});
app.post("/auth/signup", async (req, res) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
        return res.status(400).json({ ok: false, error: "Email already in use" });
    const signupBonus = Number(await getConfig("signup_bonus", DEFAULT_SIGNUP_BONUS)) || 100;
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, passwordHash, scratchCoin: signupBonus, lastDailyClaimAt: null },
        select: { id: true, email: true, scratchCoin: true },
    });
    await prisma.$transaction(async (tx) => {
        await logLedgerSafe(tx, user.id, "signup", user.scratchCoin, user.scratchCoin, { email: user.email });
    });
    res.cookie("session", signSession(user.id), COOKIE_OPTIONS);
    return res.json({ ok: true });
});
app.post("/auth/login", loginRateLimit, async (req, res) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
    const now = new Date();
    if (user.lockUntil && user.lockUntil.getTime() > now.getTime()) {
        return res.status(429).json({ ok: false, error: "Too many failed login attempts. Try again later." });
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok) {
        const failedLoginCount = (user.failedLoginCount || 0) + 1;
        const shouldLock = failedLoginCount >= 5;
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginCount,
                lockUntil: shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null,
            },
        });
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockUntil: null },
    });
    res.cookie("session", signSession(user.id), COOKIE_OPTIONS);
    return res.json({ ok: true });
});
app.post("/auth/logout", (_req, res) => {
    res.clearCookie("session", COOKIE_CLEAR_OPTIONS);
    res.json({ ok: true });
});
app.get("/me", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, scratchCoin: true, lastDailyClaimAt: true },
    });
    if (!user)
        return res.status(401).json({ ok: false, error: "Not logged in" });
    return res.json({ ok: true, user });
});
app.post("/rewards/daily-claim", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const dailyReward = Number(await getConfig("daily_reward", DEFAULT_DAILY_REWARD)) || 25;
    const ms24h = 24 * 60 * 60 * 1000;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { scratchCoin: true, lastDailyClaimAt: true },
            });
            if (!user)
                return { status: 401, body: { ok: false, error: "Not logged in" } };
            const now = new Date();
            const last = user.lastDailyClaimAt ? user.lastDailyClaimAt.getTime() : 0;
            const msSince = last ? now.getTime() - last : ms24h + 1;
            if (user.lastDailyClaimAt && msSince < ms24h) {
                return { status: 400, body: { ok: false, error: "Already claimed", msLeft: ms24h - msSince } };
            }
            const updated = await tx.user.updateMany({
                where: { id: userId, OR: [{ lastDailyClaimAt: user.lastDailyClaimAt }, { lastDailyClaimAt: null }] },
                data: { lastDailyClaimAt: now, scratchCoin: { increment: dailyReward } },
            });
            if (updated.count !== 1) {
                return { status: 400, body: { ok: false, error: "Already claimed", msLeft: ms24h } };
            }
            const after = await tx.user.findUnique({ where: { id: userId }, select: { scratchCoin: true } });
            const scratchCoin = after?.scratchCoin ?? user.scratchCoin + dailyReward;
            await logLedgerSafe(tx, userId, "daily", dailyReward, scratchCoin, {});
            return { status: 200, body: { ok: true, reward: dailyReward, scratchCoin } };
        });
        return res.status(result.status).json(result.body);
    }
    catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || "Server error" });
    }
});
app.get("/scratchers/tickets", async (_req, res) => {
    const raw = await getConfig("scratch_config", DEFAULT_SCRATCH_CONFIG);
    const config = (0, crossword_1.parseTicketEconomyConfig)(raw);
    const ticket = getFreePlayTicketConfig(config);
    return res.json({
        ok: true,
        tickets: [
            {
                id: FREE_PLAY_TICKET_ID,
                title: "Free Play",
                costCoin: 0,
                prizes: Array.from(new Set((ticket.payouts ?? []).map((entry) => Number(entry.amount || 0)))).sort((a, b) => a - b),
            },
        ],
    });
});
app.post("/scratchers/play", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const parsed = PlayScratchBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const raw = await getConfig("scratch_config", DEFAULT_SCRATCH_CONFIG);
    const config = (0, crossword_1.parseTicketEconomyConfig)(raw);
    const ticketId = FREE_PLAY_TICKET_ID;
    const ticket = getFreePlayTicketConfig(config);
    if (!ticket)
        return res.status(404).json({ ok: false, error: "Unknown ticket" });
    const payouts = Array.isArray(ticket.payouts) ? ticket.payouts : [];
    const winAmount = (0, crossword_1.pickWeightedPayout)(payouts);
    let newBalance = await getScratchCoinBalance(userId);
    if (winAmount > 0) {
        const award = await adjustCoinsAtomic({
            userId,
            delta: winAmount,
            kind: "scratcher_win",
            meta: { ticketId, cost: 0, winAmount },
        });
        if (!award.ok)
            return res.status(400).json(award);
        newBalance = award.scratchCoin;
    }
    return res.json({
        ok: true,
        ticketId,
        cost: 0,
        winAmount,
        net: winAmount,
        newBalance,
    });
});
app.post("/triple-crown-derby/play", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const parsed = PlayScratchBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const raw = await getConfig("triple_crown_derby_config", DEFAULT_TRIPLE_CROWN_DERBY_CONFIG);
    const config = (0, crossword_1.parseTicketEconomyConfig)(raw);
    const ticketId = FREE_PLAY_TICKET_ID;
    const ticket = getFreePlayTicketConfig(config);
    if (!ticket)
        return res.status(404).json({ ok: false, error: "Unknown ticket" });
    const payouts = Array.isArray(ticket.payouts) ? ticket.payouts : [];
    const winAmount = (0, crossword_1.pickWeightedPayout)(payouts);
    let newBalance = await getScratchCoinBalance(userId);
    if (winAmount > 0) {
        const award = await adjustCoinsAtomic({
            userId,
            delta: winAmount,
            kind: "triple_crown_derby_win",
            meta: { ticketId, cost: 0, winAmount },
        });
        if (!award.ok)
            return res.status(400).json(award);
        newBalance = award.scratchCoin;
    }
    return res.json({
        ok: true,
        ticketId,
        cost: 0,
        winAmount,
        net: winAmount,
        newBalance,
    });
});
app.post("/the-big-score/play", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const parsed = PlayScratchBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const raw = await getConfig("the_big_score_config", DEFAULT_THE_BIG_SCORE_CONFIG);
    const config = (0, crossword_1.parseTicketEconomyConfig)(raw);
    const ticketId = FREE_PLAY_TICKET_ID;
    const ticket = getFreePlayTicketConfig(config);
    if (!ticket)
        return res.status(404).json({ ok: false, error: "Unknown ticket" });
    const payouts = Array.isArray(ticket.payouts) ? ticket.payouts : [];
    const winAmount = (0, crossword_1.pickWeightedPayout)(payouts);
    let newBalance = await getScratchCoinBalance(userId);
    if (winAmount > 0) {
        const award = await adjustCoinsAtomic({
            userId,
            delta: winAmount,
            kind: "the_big_score_win",
            meta: { ticketId, cost: 0, winAmount },
        });
        if (!award.ok)
            return res.status(400).json(award);
        newBalance = award.scratchCoin;
    }
    return res.json({
        ok: true,
        ticketId,
        cost: 0,
        winAmount,
        net: winAmount,
        newBalance,
    });
});
app.post("/crossword/start", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const parsed = StartCrosswordBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    const raw = await getConfig("crossword_config", DEFAULT_CROSSWORD_CONFIG);
    const config = (0, crossword_1.parseTicketEconomyConfig)(raw);
    const ticketId = FREE_PLAY_TICKET_ID;
    const ticket = getFreePlayTicketConfig(config);
    if (!ticket)
        return res.status(404).json({ ok: false, error: "Unknown ticket" });
    const rewardAmount = (0, crossword_1.pickWeightedPayout)(ticket.payouts ?? []);
    const newBalance = await getScratchCoinBalance(userId);
    const session = await prisma.crosswordTicketSession.create({
        data: {
            userId,
            ticketId,
            cost: 0,
            rewardAmount,
        },
        select: {
            id: true,
            ticketId: true,
            cost: true,
            rewardAmount: true,
        },
    });
    return res.json({
        ok: true,
        sessionId: session.id,
        ticketId: session.ticketId,
        cost: session.cost,
        winAmount: session.rewardAmount,
        net: 0,
        newBalance,
    });
});
app.post("/crossword/claim", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId)
        return;
    const parsed = ClaimCrosswordBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: "Invalid input" });
    try {
        const result = await prisma.$transaction(async (tx) => {
            const session = await tx.crosswordTicketSession.findFirst({
                where: {
                    id: parsed.data.sessionId,
                    userId,
                },
            });
            if (!session) {
                return { status: 404, body: { ok: false, error: "Crossword session not found" } };
            }
            const claim = (0, crossword_1.resolveCrosswordClaim)(session);
            if (!claim.alreadyClaimed) {
                await tx.crosswordTicketSession.update({
                    where: { id: session.id },
                    data: { claimedAt: new Date() },
                });
            }
            if (claim.claimDelta > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: { scratchCoin: { increment: claim.claimDelta } },
                });
            }
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { scratchCoin: true },
            });
            if (!user) {
                return { status: 401, body: { ok: false, error: "Not logged in" } };
            }
            if (!claim.alreadyClaimed) {
                await logLedgerSafe(tx, userId, "crossword_claim", claim.claimDelta, user.scratchCoin, {
                    sessionId: session.id,
                    ticketId: session.ticketId,
                    cost: session.cost,
                    rewardAmount: session.rewardAmount,
                });
            }
            return {
                status: 200,
                body: {
                    ok: true,
                    sessionId: session.id,
                    rewardAmount: session.rewardAmount,
                    alreadyClaimed: claim.alreadyClaimed,
                    newBalance: user.scratchCoin,
                    net: session.rewardAmount - session.cost,
                },
            };
        });
        return res.status(result.status).json(result.body);
    }
    catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || "Server error" });
    }
});
ensureConfigSeeded()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`Scratchoff Lite backend listening on http://localhost:${PORT}`);
    });
})
    .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
});
