import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';

const token = process.env.TELEGRAM_BOT_TOKEN || "9296311020:AAGKeEJQv2jdjOzRlON5bV8o3OY3c-iR1hk";
const bot = new Telegraf(token);

// Upstash Redis Database ချိတ်ဆက်ခြင်း
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const body = req.body || {};
        
        // Telegram Webhook Update Handle (စာပြန်ခြင်းမရှိ၊ ငြိမ်သက်စွာနေမည်)
        if (body.update_id) {
            // လိုအပ်ပါက Telegraf update handle ကို ဒီမှာ သုံးနိုင်သည် (သို့သော် referral ကို Mini App login မှ အသေအချာကိုင်တွယ်သည်)
            try {
                await bot.handleUpdate(body);
            } catch (e) {
                console.error("Bot update error:", e);
            }
            return res.status(200).json({ status: 'ok' });
        }

        if (req.method === 'POST') {
            const { action, userId, startPayload } = body;
            
            if (!userId) {
                return res.status(400).json({ success: false, error: "Missing userId" });
            }
            
            const stringUserId = userId.toString();
            const userKey = `user:${stringUserId}:points`;
            const refCheckedKey = `user:${stringUserId}:ref_checked`;

            // 1. Login / Get Points & Referral Processing
            if (action === 'login' || action === 'get_points') {
                let points = await redis.get(userKey);

                // User အသစ်ဖြစ်လျှင် ပွိုင့် 0 စတင်မည်
                if (points === null) {
                    points = 0;
                    await redis.set(userKey, points);
                }

                // Referral စစ်ဆေးခြင်း (Mini App ဝင်လာချိန် startPayload ပါလာပါက)
                if (startPayload && startPayload.startsWith('ref_')) {
                    const referrerId = startPayload.replace('ref_', '');
                    const isRefChecked = await redis.get(refCheckedKey);

                    // မိမိကိုယ်ကို ပြန်မဖိတ်ရပါ၊ နှင့် ဒီလူသည် တစ်ခါမှ referral ဆုမရသေးမှသာ
                    if (referrerId !== stringUserId && !isRefChecked) {
                        // ဤ user သည် referral ယူပြီးပြီဟု အမြဲတမ်း မှတ်ထားမည်
                        await redis.set(refCheckedKey, 'true');

                        const referrerKey = `user:${referrerId}:points`;
                        let referrerPoints = await redis.get(referrerKey);
                        
                        if (referrerPoints === null) {
                            referrerPoints = 100;
                        } else {
                            referrerPoints = parseInt(referrerPoints, 10) + 100;
                        }
                        
                        // ဖိတ်တဲ့သူ့ကို +100 PTS တိုက်ရိုက် ပေါင်းပေးမည်
                        await redis.set(referrerKey, referrerPoints);
                    }
                }

                // လက်ရှိ user ရဲ့ ပွိုင့်အမှန်ကို ပြန်ထုတ်ပေးမည်
                const finalPoints = await redis.get(userKey);

                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(finalPoints || 0, 10) 
                });
            }

            // 2. Watched Ad (+10 PTS)
            if (action === 'watched_ad') {
                let points = await redis.get(userKey);
                if (points === null) points = 0;
                
                points = parseInt(points, 10) + 10;
                await redis.set(userKey, points);
                
                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(points, 10) 
                });
            }
        }

        if (req.method === 'GET') {
            return res.status(200).send('Telegram Bot Server is running successfully!');
        }

        return res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error("Error handling request:", error);
        return res.status(500).json({ error: error.message });
    }
};
