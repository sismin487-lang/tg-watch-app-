import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // CORS Headers သတ်မှတ်ခြင်း
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, userId, username } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // 1. User Login / Account Register လုပ်ခြင်း
        if (action === 'login') {
            let user = await kv.hgetall(`user:${userId}`);
            
            if (!user || !user.userId) {
                // User အသစ်ဖြစ်ပါက Database ထဲ စတင်သိမ်းဆည်းမည်
                user = {
                    userId: userId,
                    username: username || 'Unknown',
                    points: 0,
                    createdAt: new Date().toISOString()
                };
                await kv.hset(`user:${userId}`, user);
            }

            return res.status(200).json({ 
                success: true, 
                message: 'User logged in successfully',
                data: user 
            });
        }

        // 2. ကြော်ငြာကြည့်ပြီး၍ အမှတ် (+10 PTS) တိုးပေးခြင်း
        if (action === 'watched_ad') {
            // Database ထဲမှာ အမှတ် ၁၀ မှတ် ပေါင်းထည့်မည်
            const newPoints = await kv.hincrby(`user:${userId}`, 'points', 10);

            return res.status(200).json({ 
                success: true, 
                message: '10 Points added successfully',
                points: newPoints 
            });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

