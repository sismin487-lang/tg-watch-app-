import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';

const token = process.env.TELEGRAM_BOT_TOKEN || "9296311020:AAGKeEJQv2jdjOzRlON5bV8o3OY3c-iR1hk";
const bot = new Telegraf(token);

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const body = req.body || {};
        
        if (body.update_id) {
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

            if (action === 'login' || action === 'get_points') {
                let points = await redis.get(userKey);

                if (points === null) {
                    points = 0;
                    await redis.set(userKey, points);
                }

                // 🛠 Referral စစ်ဆေးခြင်းနှင့် ပွိုင့်ပေါင်းထည့်ခြင်း
                if (action === 'login' && startPayload) {
                    // ref_ ပါသည်ဖြစ်စေ၊ ID သက်သက်ဖြစ်စေ ဖြုတ်ထုတ်ပြီး referrerId ကို သေချာထုတ်ယူမည်
                    const referrerId = startPayload.toString().replace('ref_', '').trim();
                    const isRefChecked = await redis.get(refCheckedKey);

                    if (referrerId && referrerId !== stringUserId && !isRefChecked) {
                        // တစ်ကြိမ်သာ ခွင့်ပြုရန် ref_checked ကို true မှတ်မည်
                        await redis.set(refCheckedKey, 'true');

                        const referrerKey = `user:${referrerId}:points`;
                        let referrerPoints = await redis.get(referrerKey);
                        
                        if (referrerPoints === null) {
                            referrerPoints = 100;
                        } else {
                            referrerPoints = parseInt(referrerPoints, 10) + 100;
                        }
                        
                        // ဖိတ်တဲ့သူ့ဆီသို့ +100 PTS တိုက်ရိုက် ပေါင်းထည့်မည်
                        await redis.set(referrerKey, referrerPoints);
                    }
                }

                const finalPoints = await redis.get(userKey);

                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(finalPoints || 0, 10) 
                });
            }

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
