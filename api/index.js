const { Telegraf } = require('telegraf');

// ဘော့စ်ပေးထားသော တိုကန်အမှန်ကို တိုက်ရိုက် ထည့်သွင်းထားပါသည်
const token = "9296311020:AAGKeEJQv2jdjOzRlON5bV8o3OY3c-iR1hk";
if (!token) {
    console.error("BOT_TOKEN is not defined!");
}

const bot = new Telegraf(token);

if (!global.userPoints) {
    global.userPoints = {};
}

// Bot /start command with referral handling
bot.start(async (ctx) => {
    const userName = ctx.from.first_name || 'User';
    const startPayload = ctx.payload;

    if (startPayload && startPayload.startsWith('ref_')) {
        const referrerId = startPayload.replace('ref_', '');
        const currentUserId = ctx.from.id.toString();

        if (referrerId !== currentUserId) {
            if (!global.userPoints[referrerId]) {
                global.userPoints[referrerId] = 0;
            }
            global.userPoints[referrerId] += 100;
        }
    }

    await ctx.reply(`မင်္ဂလာပါ ${userName}! Tg Watch & Earn Mini App မှ ကြိုဆိုပါတယ်။ ဗီဒီယိုကြည့်ပြီး ပွိုင့်များ စုဆောင်းနိုင်ပါပြီ။`, {
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
            
            if (action === 'login' || action === 'get_points') {
                if (!userId) {
                    return res.status(400).json({ success: false, error: "Missing userId" });
                }
                if (!global.userPoints[userId]) {
                    global.userPoints[userId] = 0;
                }
                return res.status(200).json({ 
                    success: true, 
                    points: global.userPoints[userId] 
                });
            }

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
