import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(token);

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const AD_TEXT = `🔥 Watch & Earn - ကြော်ငြာကြည့်ပြီး ပိုက်ဆံရှာပါ!

ကြော်ငြာ 1 ခု ကြည့်တိုင်း = +15 Points
သူငယ်ချင်းခေါ်တိုင်း = +100 Points
1500 Points ပြည့်တာနဲ့ ထုတ်လို့ရပြီ!

TON / KPay / WavePay နဲ့ ထုတ်လို့ရတယ်
အလကား - ဘာမှပေးစရာမလိုဘူး
နေ့တိုင်း ကြော်ငြာကြည့်ပြီး ရှာလို့ရတယ်

အခုပဲ စလိုက်ပါ!`;

const START_TEXT = AD_TEXT + `

စဖို့ အောက်က Button ကိုနှိပ်ပါ`;

bot.start(async (ctx) => {
  try {
    const webappUrl = process.env.WEBAPP_URL || 'https://tg-watch-app.vercel.app';
    const keyboard = [[{ text: ' App ဖွင့်မယ်', web_app: { url: webappUrl } }]];
    await ctx.reply(START_TEXT, { reply_markup: { inline_keyboard: keyboard } });
  } catch (e) {
    try { await ctx.reply(START_TEXT); } catch (e2) {}
  }
});

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  try { await ctx.reply(AD_TEXT); } catch (e) {}
});

bot.command('ad', async (ctx) => {
  await ctx.reply(AD_TEXT);
});

bot.help(async (ctx) => {
  await ctx.reply(AD_TEXT);
});

function verifyTelegram(initData) {
  if (!initData || !token) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (calc !== hash) return null;
    return JSON.parse(params.get('user') || '{}');
  } catch (e) { return null; }
}

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
        let body = req.body || {};
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        if (body.update_id) {
            try { await bot.handleUpdate(body); } catch (e) {}
            return res.status(200).json({ status: 'ok' });
        }
        if (req.method === 'POST') {
            const { action, userId, startPayload, initData, walletAddress } = body;
            if (action === 'get_ad_text') {
                return res.status(200).json({ success: true, adText: AD_TEXT });
            }
            if (!userId) {
                return res.status(400).json({ success: false, error: "Missing userId" });
            }
            const stringUserId = userId.toString();
            const userKey = `user:${stringUserId}:points`;
            const refCheckedKey = `user:${stringUserId}:ref_checked`;
            if (initData) {
                const tgUser = verifyTelegram(initData);
                if (!tgUser || String(tgUser.id) !== stringUserId) {
                    return res.status(403).json({ success: false, error: "Invalid Telegram data" });
                }
            }
            if (action === 'login' || action === 'get_points') {
                let points = await redis.get(userKey);
                if (points === null) { points = 0; await redis.set(userKey, points); }
                if (action === 'login' && startPayload) {
                    const referrerId = startPayload.toString().replace('ref_', '').trim();
                    const isRefChecked = await redis.get(refCheckedKey);
                    if (referrerId && referrerId !== stringUserId && !isRefChecked) {
                        await redis.set(refCheckedKey, 'true');
                        const referrerKey = `user:${referrerId}:points`;
                        let referrerPoints = await redis.get(referrerKey);
                        if (referrerPoints === null) { referrerPoints = 100; }
                        else { referrerPoints = parseInt(referrerPoints, 10) + 100; }
                        await redis.set(referrerKey, referrerPoints);
                    }
                }
                const finalPoints = await redis.get(userKey);
                const pending = await redis.get(`user:${stringUserId}:pending_withdraw`);
                return res.status(200).json({ success: true, points: parseInt(finalPoints || 0, 10), pendingWithdraw: pending ? parseInt(pending, 10) : 0 });
            }
            if (action === 'watched_ad') {
                const lastAdKey = `user:${stringUserId}:last_ad`;
                const lastAd = await redis.get(lastAdKey);
                const now = Date.now();
                if (lastAd && (now - parseInt(lastAd, 10)) < 10000) {
                    const cur = await redis.get(userKey);
                    return res.status(200).json({ success: true, points: parseInt(cur || 0, 10) });
                }
                await redis.set(lastAdKey, now);
                let points = await redis.get(userKey);
                if (points === null) points = 0;
                points = parseInt(points, 10) + 15;
                await redis.set(userKey, points);
                return res.status(200).json({ success: true, points: parseInt(points, 10) });
            }
            if (action === 'vpn_bonus') {
                const today = new Date().toISOString().slice(0, 10);
                const vpnKey = `user:${stringUserId}:vpn_bonus:${today}`;
                const count = parseInt(await redis.get(vpnKey)) || 0;
                if (count >= 10) {
                    const cur = await redis.get(userKey);
                    return res.status(200).json({ success: true, points: parseInt(cur || 0, 10), limitReached: true });
                }
                await redis.incr(vpnKey);
                await redis.expire(vpnKey, 86400);
                const points = await redis.incrby(userKey, 5);
                return res.status(200).json({ success: true, points: parseInt(points, 10), limitReached: false });
            }
            if (action === 'request_withdraw') {
                let points = await redis.get(userKey);
                points = parseInt(points || 0, 10);
                if (points < 1500) { return res.status(200).json({ success: false, error: "Points မလုံလောက်ပါ" }); }
                if (!walletAddress) { return res.status(200).json({ success: false, error: "Wallet လိပ်စာ မပါပါ" }); }
                const payMethod = body.payMethod || "TON";
                if (!["TON", "KPay", "WavePay"].includes(payMethod)) { return res.status(200).json({ success: false, error: "Payment Method မမှန်ပါ" }); }
                await redis.set(userKey, 0);
                await redis.set(`user:${stringUserId}:pending_withdraw`, points);
                const withdrawId = `${Date.now()}_${stringUserId}`;
                await redis.set(`withdraw:${withdrawId}`, JSON.stringify({ userId: stringUserId, walletAddress: walletAddress, payMethod: payMethod, points: points, status: 'pending', createdAt: new Date().toISOString() }));
                try {
                    const adminId = process.env.ADMIN_ID;
                    if (adminId) {
                        await bot.telegram.sendMessage(adminId, ` Withdraw အသစ်!\n\nUser ID: ${stringUserId}\nMethod: ${payMethod}\nAccount: ${walletAddress}\nPoints: ${points} PTS`);
                    }
                } catch (e) {}
                return res.status(200).json({ success: true, points: 0 });
            }
        }
        if (req.method === 'GET') {
            if (req.query && req.query.setup === '1') {
                const host = req.headers.host;
                const webhookUrl = `https://${host}/api/index`;
                try { await bot.telegram.setWebhook(webhookUrl); return res.status(200).send('Webhook OK: ' + webhookUrl); }
                catch (e) { return res.status(500).send('Webhook FAILED: ' + e.message); }
            }
            return res.status(200).send('Telegram Bot Server is running successfully!');
        }
        return res.status(200).json({ status: 'received' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
