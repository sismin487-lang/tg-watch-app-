import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const userId = req.query.userid;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userid parameter' });
        }

        // Adsgram ကနေ တိုက်ရိုက်လာသည့်အတွက် အမှတ် ၁၀ မှတ် ပေါင်းပေးမည်
        const newPoints = await kv.hincrby(`user:${userId}`, 'points', 10);

        return res.status(200).json({
            success: true,
            message: 'Reward added via Adsgram callback',
            userId: userId,
            points: newPoints
        });
    } catch (error) {
        console.error('Reward API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
