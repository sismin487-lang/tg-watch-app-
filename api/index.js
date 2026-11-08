const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error("BOT_TOKEN is not defined in environment variables!");
}

const bot = new Telegraf(token);

if (!global.userPoints) {
    global.userPoints = {};
}

bot.start((ctx) => {
    const userName = ctx.from.first_name || 'User';
    ctx.reply(`မင်္ဂလာပါ ${userName}! Tg Watch Ads & Reward Mini App မှ ကြိုဆိုပါတယ်။ ဗီဒီယိုကြည့်ပြီး ပွိုင့်များ စုဆောင်းနိုင်ပါပြီ။`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 Open Mini App", web_app: { url: "https://tg-watch-app.vercel.app" } }]
            ]
        }
    });
});

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const body = req.body || {};
            const { action, userId } = body;
            
            if (action === 'watched_ad') {
                if (!userId) {
                    return res.status(400).json({ success: false, error: "Missing userId" });
                }
                
                if (!global.userPoints[userId]) {
                    global.userPoints[userId] = 0;
                }
                global.userPoints[userId] += 10;
                
                return res.status(200).json({ 
                    success: true, 
                    points: global.userPoints[userId] 
                });
            }
            
            if (action === 'get_points') {
                const points = global.userPoints[userId] || 0;
                return res.status(200).json({ success: true, points });
            }

            // Handle standard Telegram webhook updates
            if (body.update_id) {
                await bot.handleUpdate(body);
                return res.status(200).json({ status: 'ok' });
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
