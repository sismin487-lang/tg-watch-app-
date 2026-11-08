const { Telegraf } = require('telegraf');
const { kv } = require('@vercel/kv');

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminChatId = "52504489";

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const text = ctx.message.text || '';
        const parts = text.split(' ');
        
        if (parts.length > 1 && parts[1].startsWith('ref_')) {
            const referrerId = parts[1].replace('ref_', '');
            
            if (referrerId !== userId) {
                // Check if this user was already referred by anyone
                const alreadyReferred = await kv.sismember(`referred:${referrerId}`, userId);
                const hasBeenReferredAnywhere = await kv.get(`user_referred_status:${userId}`);

                if (!alreadyReferred && !hasBeenReferredAnywhere) {
                    // Mark user as referred
                    await kv.sadd(`referred:${referrerId}`, userId);
                    await kv.set(`user_referred_status:${userId}`, 'yes');

                    // Add 100 points to referrer
                    const currentPoints = await kv.get(`points:${referrerId}`) || 0;
                    const newPoints = Number(currentPoints) + 100;
                    await kv.set(`points:${referrerId}`, newPoints);

                    try {
                        await bot.telegram.sendMessage(referrerId, `ဂုဏ်ယူပါတယ်!\n\nသင့်ရဲ့ ဖိတ်ကြားရေးလင့်ခ်မှတဆင့် သူငယ်ချင်းအသစ် ဝင်ရောက်လာလို့ +100 PTS ရရှိသွားပါပြီ။ လက်ရှိစုစုပေါင်း: ${newPoints} PTS`);
                    } catch (e) {}
                }
            }
        }

        const welcomeAdsText = `Tg Watch & Earn မှ ကြိုဆိုပါတယ်ဗျာ!\n\nဗီဒီယိုကြော်ငြာများ ကြည့်ရှုပြီး နေ့စဥ် အမှတ်များ ရှာဖွေလိုက်ပါ။\nသူငယ်ချင်းများကို ဖိတ်ခေါ်ပြီး အကျိုးအမြတ်များ ပိုမိုရယူလိုက်ပါ!\n\nအောက်ပါခလုတ်ကို နှိပ်၍ Mini App ကို စတင်လိုက်ပါ 👇`;
        
        await ctx.reply(welcomeAdsText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Tg Watch App ဖွင့်မည်", web_app: { url: "https://tg-watch-app.vercel.app" } }]
                ]
            }
        });
    } catch (e) {
        console.error("Start command error:", e);
    }
});

bot.on('message', async (ctx) => {
    try {
        const msg = ctx.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text || '';
        const userId = ctx.from.id.toString();
        const userName = ctx.from.first_name || 'User';

        if (chatId === adminChatId) {
            if (msg.reply_to_message) {
                const repliedText = msg.reply_to_message.text || '';
                const match = repliedText.match(/ID:\s*(\d+)/);
                if (match && match[1]) {
                    const targetUserId = match[1];
                    await bot.telegram.sendMessage(targetUserId, `Admin မှ တုံ့ပြန်ချက်:\n\n${text}`);
                    await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
                    return;
                }
            }

            if (text.startsWith('/reply')) {
                const parts = text.split(' ');
                if (parts.length < 3) {
                    return ctx.reply("❌ ဥပမာ - /reply UserID မက်ဆေ့ချ်စာသား");
                }
                const targetUserId = parts[1];
                const replyText = parts.slice(2).join(' ');
                await bot.telegram.sendMessage(targetUserId, `Admin မှ တုံ့ပြန်ချက်:\n\n${replyText}`);
                await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
                return;
            }
        }

        if (chatId !== adminChatId && !text.startsWith('/start')) {
            await bot.telegram.sendMessage(adminChatId, `မက်ဆေ့ချ်အသစ် ရောက်ရှိသည်\n\nအမည်: ${userName}\nID: ${userId}\nစာသား: ${text}`);
        }
    } catch (e) {
        console.error("Message handler error:", e);
    }
});

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const body = req.body;
            
            if (body && body.action === 'send_admin_msg') {
                await bot.telegram.sendMessage(adminChatId, `Mini App မှ Direct Message\n\nUser ID: ${body.userId}\nစာသား: ${body.message}`);
                return res.status(200).json({ success: true });
            }

            if (body && body.action === 'watched_ad') {
                const userId = body.userId;
                const currentPoints = await kv.get(`points:${userId}`) || 0;
                const newPoints = Number(currentPoints) + 10;
                await kv.set(`points:${userId}`, newPoints);
                return res.status(200).json({ success: true, points: newPoints });
            }

            await bot.handleUpdate(body);
            return res.status(200).json({ status: 'ok' });
        } else {
            return res.status(200).send('Telegram Bot Server is running successfully!');
        }
    } catch (e) {
        console.error("Webhook error:", e);
        return res.status(500).json({ error: e.message });
    }
};
