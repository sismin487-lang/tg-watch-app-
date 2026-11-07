const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminChatId = "52504489"; // သင့်ရဲ့ Admin Telegram ID အမှန်

global.dbPoints = global.dbPoints || {};
global.referredUsers = global.referredUsers || new Set();

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const text = ctx.message.text || '';
        const parts = text.split(' ');
        
        if (parts.length > 1 && parts[1].startsWith('ref_')) {
            const referrerId = parts[1].replace('ref_', '');
            if (referrerId !== userId && !global.referredUsers.has(userId)) {
                global.referredUsers.add(userId);
                global.dbPoints[referrerId] = (global.dbPoints[referrerId] || 0) + 100;
                try {
                    await bot.telegram.sendMessage(referrerId, `🎉 **ဂုဏ်ယူပါတယ်ခင်ဗျာ!**\n\nသင့်ရဲ့ ဖိတ်ကြားရေးလင့်ခ်မှတဆင့် သူငယ်ချင်းအသစ် ဝင်ရောက်လာလို့ **+100 PTS** ရရှိသွားပါပြီ။ 🎁`, {
                        parse_mode: 'Markdown'
                    });
                } catch (e) {}
            }
        }

        const welcomeAdsText = `
🎉 **Tg Watch & Earn မှ ကြိုဆိုပါတယ်ခင်ဗျာ!** 🎉

💎 **ဗီဒီယိုကြော်ငြာများ ကြည့်ရှုပြီး နေ့စဥ် အမှတ်များ ရှာဖွေလိုက်ပါ။**
🚀 **သူငယ်ချင်းများကို ဖိတ်ခေါ်ပြီး အကျိုးအမြတ်များ ပိုမိုရယူလိုက်ပါ!**

အောက်ပါခလုတ်ကို နှိပ်၍ Mini App ကို စတင်လိုက်ပါ 👇
        `;
        
        await ctx.reply(welcomeAdsText, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🚀 Tg Watch App ဖွင့်မည်",
                            web_app: { url: "https://tg-watch-app.vercel.app" }
                        }
                    ]
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
                const match = repliedText.match(/ID:\s*`?(\d+)`?/);
                if (match && match[1]) {
                    const targetUserId = match[1];
                    await bot.telegram.sendMessage(targetUserId, `💬 **Admin မှ တုံ့ပြန်ချက်:**\n\n${text}`, { parse_mode: 'Markdown' });
                    await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
                    return;
                }
            }

            if (text.startsWith('/reply')) {
                const parts = text.split(' ');
                if (parts.length < 3) {
                    return ctx.reply("❌ အသုံးပြုပုံ မှားယွင်းနေပါသည်။ ဥပမာ - /reply UserID မက်ဆေ့ချ်စာသား");
                }
                const targetUserId = parts[1];
                const replyText = parts.slice(2).join(' ');
                await bot.telegram.sendMessage(targetUserId, `💬 **Admin မှ တုံ့ပြန်ချက်:**\n\n${replyText}`, { parse_mode: 'Markdown' });
                await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
                return;
            }
        }

        if (chatId !== adminChatId && !text.startsWith('/start')) {
            await bot.telegram.sendMessage(adminChatId, `📩 **မက်ဆေ့ချ်အသစ် ရောက်ရှိသည်**\n\n👤 အမည်: ${userName}\n🆔 ID: \`${userId}\`\n💬 စာသား: ${text}`, { parse_mode: 'Markdown' });
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
                await bot.telegram.sendMessage(adminChatId, `📩 **Mini App မှ Direct Message**\n\n🆔 User ID: \`${body.userId}\`\n💬 စာသား: ${body.message}`, { parse_mode: 'Markdown' });
                return res.status(200).json({ success: true });
            }

            if (body && body.action === 'watched_ad') {
                global.dbPoints[body.userId] = (global.dbPoints[body.userId] || 0) + 10;
                return res.status(200).json({ success: true, points: global.dbPoints[body.userId] });
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
