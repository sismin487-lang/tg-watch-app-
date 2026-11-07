const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminChatId = "52504489"; // Admin Telegram ID အမှန် (ပုံထဲပါသည့် ID)

bot.on('message', async (ctx) => {
    try {
        const msg = ctx.message;
        const chatId = msg.chat.id;
        const text = msg.text || '';

        // 1. /start ဖြင့် ဝင်လာလျှင် ကြော်ငြာချက်နှင့် Mini App ခလုတ်ပြရန်
        if (text.startsWith('/start')) {
            const userName = msg.from.first_name || 'User';

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
            return;
        }

        // 2. Admin ထံမှ User ဆီသို့ /reply ဖြင့် ပြန်ကြားရန်
        if (chatId.toString() === adminChatId && text.startsWith('/reply')) {
            const parts = text.split(' ');
            if (parts.length < 3) {
                return ctx.reply("❌ အသုံးပြုပုံ မှားယွင်းနေပါသည်။ ဥပမာ - /reply UserID မက်ဆေ့ချ်စာသား");
            }
            const targetUserId = parts[1];
            const replyText = parts.slice(2).join(' ');

            try {
                await bot.telegram.sendMessage(targetUserId, `💬 **Admin မှ တုံ့ပြန်ချက်:**\n\n${replyText}`, {
                    parse_mode: 'Markdown'
                });
                await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
            } catch (err) {
                await ctx.reply(`❌ ပို့၍မရပါ (User က Bot ကို Blockထားခြင်း သို့မဟုတ် Chat ဖွင့်မထားခြင်း ဖြစ်နိုင်သည်)။`);
            }
            return;
        }

        // 3. User များမှ ပို့သောစာများကို Admin ဆီသို့ Forward လုပ်ရန်
        if (chatId.toString() !== adminChatId) {
            const userName = msg.from.first_name || 'User';
            await bot.telegram.sendMessage(adminChatId, `📩 **မက်ဆေ့ချ်အသစ် ရောက်ရှိသည်**\n\n👤 အမည်: ${userName}\n🆔 ID: \`${chatId}\`\n💬 စာသား: ${text}`, {
                parse_mode: 'Markdown'
            });
            await ctx.reply("✅ မက်ဆေ့ချ်ကို Admin ထံ ပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။");
        }

    } catch (e) {
        console.error(e);
    }
});

// Vercel Serverless Function Export
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            res.status(200).json({ status: 'ok' });
        } else {
            res.status(200).send('Telegram Bot Server is running successfully!');
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
