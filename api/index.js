import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// FIXED - Don't write Token in code, take it only from Vercel Env
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(token);

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// FIXED - Added to check if Telegram initData is real or fake
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
            const { action, userId, startPayload, initData, walletAddress } = body;
            
            if (!userId) {
                return res.status(400).json({ success: false, error: "Missing userId" });
            }
            
            const stringUserId = userId.toString();
            const userKey = `user:${stringUserId}:points`;
            const refCheckedKey = `user:${stringUserId}:ref_checked`;

            // FIXED - If initData is sent, check if it is real
            if (initData) {
                const tgUser = verifyTelegram(initData);
                if (!tgUser || String(tgUser.id) !== stringUserId) {
                    return res.status(403).json({ success: false, error: "Invalid Telegram data" });
                }
            }

            if (action === 'login' || action === 'get_points') {
                let points = await redis.get(userKey);

                if (points === null) {
                    points = 0;
                    await redis.set(userKey, points);
                }

                // Check Referral and add points (+100 PTS)
                if (action === 'login' && startPayload) {
                    const referrerId = startPayload.toString().replace('ref_', '').trim();
                    const isRefChecked = await redis.get(refCheckedKey);

                    if (referrerId && referrerId !== stringUserId && !isRefChecked) {
                        await redis.set(refCheckedKey, 'true');

                        const referrerKey = `user:${referrerId}:points`;
                        let referrerPoints = await redis.get(referrerKey);
                        
                        if (referrerPoints === null) {
                            referrerPoints = 100;
                        } else {
                            referrerPoints = parseInt(referrerPoints, 10) + 100;
                        }
                        
                        await redis.set(referrerKey, referrerPoints);
                    }
                }

                const finalPoints = await redis.get(userKey);
                const pending = await redis.get(`user:${stringUserId}:pending_withdraw`);

                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(finalPoints || 0, 10),
                    pendingWithdraw: pending ? parseInt(pending, 10) : 0
                });
            }

            if (action === 'watched_ad') {
                // FIXED - To prevent Ad Spam, give points only once per 10 seconds
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
                
                // +15 PTS for watching one ad
                points = parseInt(points, 10) + 15;
                await redis.set(userKey, points);
                
                return res.status(200).json({ 
                    success: true, 
                    points: parseInt(points, 10) 
                });
            }

            // FIXED - Added request_withdraw which did not exist before
            // Frontend was sending this but Backend did not accept it, so Withdraw did not work
            if (action === 'request_withdraw') {
                let points = await redis.get(userKey);
                points = parseInt(points || 0, 10);

                if (points < 1500) {
                    return res.status(200).json({ success: false, error: "Points မလုံလောက်ပါ" });
                }
                if (!walletAddress) {
                    return res.status(200).json({ success: false, error: "Wallet လိပ်စာ မပါပါ" });
                }

                // FIXED - Added payMethod: TON / KPay / WavePay
                const payMethod = body.payMethod || "TON";
                if (!["TON", "KPay", "WavePay"].includes(payMethod)) {
                    return res.status(200).json({ success: false, error: "Payment Method မမှန်ပါ" });
                }

                await redis.set(userKey, 0);
                await redis.set(`user:${stringUserId}:pending_withdraw`, points);

                const withdrawId = `${Date.now()}_${stringUserId}`;
                await redis.set(`withdraw:${withdrawId}`, JSON.stringify({
                    userId: stringUserId,
                    walletAddress: walletAddress,
                    payMethod: payMethod,
                    points: points,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                }));

                // FIXED - Notify Admin when user requests withdraw
                try {
                    const adminId = process.env.ADMIN_ID;
                    if (adminId) {
                        await bot.telegram.sendMessage(adminId,
                            ` Withdraw အသစ်!\n\n` +
                            `User ID: ${stringUserId}\n` +
                            `Method: ${payMethod}\n` +
                            `Account: ${walletAddress}\n` +
                            `Points: ${points} PTS`
                        );
                    }
                } catch (e) { console.log("Admin notify failed", e); }

                return res.status(200).json({ success: true, points: 0 });
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
