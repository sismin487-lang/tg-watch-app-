import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { adminKey, message } = req.body;

        // Admin Secret Key ဖြင့် လုံခြုံရေး စစ်ဆေးခြင်း (Env ထဲတွင် ADMIN_SECRET ထည့်ရန်)
        if (adminKey !== process.env.ADMIN_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (!BOT_TOKEN) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }

        // Database ထဲတွင် ရှိသော User IDs များကို ရယူရန် (သို့မဟုတ် keys ဖြင့် ရှာရန်)
        // မှတ်ချက်။ ။ User တစ်ဦးချင်းစီ Register လုပ်စဉ်က user:ID ဖြင့် KV တွင် သိမ်းထားရန် လိုအပ်သည်
        const keys = await kv.keys('user:*');
        let successCount = 0;

        for (const key of keys) {
            const userData = await kv.hgetall(key);
            if (userData && userData.userId) {
                try {
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: userData.userId,
                            text: message,
                            parse_mode: 'Markdown'
                        })
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to send to ${userData.userId}:`, err);
                }
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Broadcast sent successfully to ${successCount} users.` 
        });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
