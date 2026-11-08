import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';

const token = "9296311020:AAGKeEJQv2jdjOzRlON5bV8o3OY3c-iR1hk";
if (!token) {
    console.error("BOT_TOKEN is not defined!");
}

const bot = new Telegraf(token);

// Upstash Redis Database တိုက်ရိုက်ချိတ်ဆက်ခြင်း
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Bot /start command with permanent Redis referral handling
bot.start(async (ctx) => {
    const userName = ctx.from.first_name || 'User';
    const startPayload = ctx.payload;
    const currentUserId = ctx.from.id.toString();

    const userKey = `user:${currentUserId}:points`;
    const refCheckedKey = `user:${currentUserId}:ref_checked`;

    // User အသစ်ဖြစ်ပါက ပွိုင့် 0 စတင်မည်
    let points = await redis.get(userKey);
    if (points === null) {
        await redis.set(userKey, 0);
    }

    // Referral စစ်ဆေးခြင်း (တစ်ခါပဲ ခွင့်ပြုမည်၊ Database ထဲမှာ အမြဲမှတ်မည်)
    if (startPayload && startPayload.startsWith('ref_')) {
        const referrerId = startPayload.replace('ref_', '');
        const isRefChecked = await redis.get(refCheckedKey);

        if (referrerId !== currentUserId && !isRefChecked) {
            await redis.set(refCheckedKey, 'true');

            const referrerKey = `user:${referrerId}:points`;
            let referrerPoints = await redis.get(referrerKey) || 0;
            referrerPoints = parseInt(referrerPoints, 10) + 100;
            
            // ဖိတ်တဲ့သူ့ကို 100 PTS အမြဲတမ်း ပေါင်းပေးမည်
            await redis.set(referrerKey, referrerPoints);
        }
    }

    await ctx.reply(`မင်္ဂလာပါ ${userName}! Tg Watch & Earn Mini App မှ ကြိုဆိုပါတယ်။ ဗီဒီယိုကြည့်ပြီး ပွိုင့်များ စုဆောင်းနိုင်ပါပြီ။`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: " Open Mini App", web_app: { url: "https://tg-watch-app.vercel.app" } }]
            ]
        }
    });
});

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'POST') {
            const body = req.body || {};
            const { action, userId, startPayload } = body;
            
            if (!userId) {
                return res.status(400).json({ success: false, error: "Missing userId" });
            }
            const stringUserId = userId.toString();
            const userKey = `user:${stringUserId}:points`;
            const refCheckedKey = `user:${stringUserId}:ref_checked`;

            // 1. Login / Get Points
            if (action === 'login' || action === 'get_points') {
                let points = await redis.get(userKey);

                if (points === null) {
                    points = 0;
                    await redis.set(userKey, points);

                    // Mini App မှတဆင့် ဝင်လာချိန် startPayload ပါလာပါက Database တွင် Referral စစ်မည်
                    if (action === 'login' && startPayload && startPayload.startsWith('ref_')) {
                        const referrerId = startPayload.replace('ref_', '');
                        const isRefChecked = await redis.get(refCheckedKey);

                        if (referrerId !== stringUserId && !isRefChecked) {
                            await redis.set(refCheckedKey, 'true');

                            const referrerKey = `user:${referrerId}:points`;
                            let referrerPoints = await redis.get(referrerKey) || 0;
                            referrerPoints = parseInt(referrerPoints, 10) + 100;
                            
                            await redis.set(referrerKey, referrerPoints);
                        }
                    }
                }

                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(points, 10) 
                });
            }

            // 2. Watched Ad (+10 PTS)
            if (action === 'watched_ad') {
                let points = await redis.get(userKey) || 0;
                points = parseInt(points, 10) + 10;
                await redis.set(userKey, points);
                
                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(points, 10) 
                });
            }

            // Telegram Webhook Update
            if (body.update_id) {
                await bot.handleUpdate(body);
                return res.status(200).json({ status: 'ok' });
            }
        }

        if (req.method === 'GET') {
            return res.status(200).send('Telegram Bot Server with Permanent Redis DB is running successfully!');
        }

        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error("Error handling request:", error);
        return res.status(500).json({ error: error.message });
    }
};
