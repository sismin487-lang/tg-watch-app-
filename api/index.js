const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminChatId = "52504489"; // သင့်ရဲ့ Admin Telegram ID အမှန်

global.dbPoints = global.dbPoints || {};
global.referredUsers = global.referredUsers || new Set();

bot.on('message', async (ctx) => {
    try {
        const msg = ctx.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text || '';
        const userId = msg.from.id.toString();

        // 1. /start ဖြင့် ဝင်လာလျှင် ကြော်ငြာချက်နှင့် Mini App ခလုတ်ကို ချက်ချင်းပြရန်
        if (text.startsWith('/start')) {
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

            // Start နှိပ်တာနဲ့ ပေါ်မည့် ကြော်ငြာချက်နှင့် ဖိတ်ခေါ်စာသား
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

        // 2. Admin ထံမှ User ဆီသို့ တိုက်ရိုက် Reply လုပ်ခြင်း (နည်းလမ်း ၂ မျိုး)
        if (chatId === adminChatId) {
            
            // 💡 နည်းလမ်း (က) - Telegram ထဲတွင် User ၏ မက်ဆေ့ချ်ကို တိုက်ရိုက် Reply နှိပ်ပြီး စာပြန်ခြင်း
            if (msg.reply_to_message) {
                const repliedText = msg.reply_to_message.text || '';
                const match = repliedText.match(/ID:\s*`?(\d+)`?/);
                
                if (match && match[1]) {
                    const targetUserId = match[1];
                    try {
                        await bot.telegram.sendMessage(targetUserId, `💬 **Admin မှ တုံ့ပြန်ချက်:**\n\n${text}`, {
                            parse_mode: 'Markdown'
                        });
                        await ctx.reply(`✅ User (${targetUserId}) ထံသို့ စာပို့ပြီးပါပြီ။`);
                    } catch (err) {
                        await ctx.reply(`❌ ပို့၍မရပါ (User က Bot ကို Blockထားခြင်း ဖြစ်နိုင်သည်)။`);
                    }
                    return;
                }
            }

            // 💡 နည်းလမ်း (ခ) - /reply [UserID] [စာသား] ဟု ရိုက်၍ ပို့ခြင်း
            if (text.startsWith('/reply')) {
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
                    await ctx.reply(`❌ ပို့၍မရပါ (User က Bot ကို Blockထားခြင်း ဖြစ်နိုင်သည်)။`);
                }
                return;
            }
        }

        // 3. User များမှ ပို့သောစာများကို Admin ဆီသို့ ပို့ရန် (Auto reply လုံးဝမပါတော့ပါ)
        if (chatId !== adminChatId) {
            const userName = msg.from.first_name || 'User';
            await bot.telegram.sendMessage(adminChatId, `📩 **မက်ဆေ့ချ်အသစ် ရောက်ရှိသည်**\n\n👤 အမည်: ${userName}\n🆔 ID: \`${userId}\`\n💬 စာသား: ${text}`, {
                parse_mode: 'Markdown'
            });
        }

    } catch (e) {
        console.error(e);
    }
});

// Vercel Serverless Function Export
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const body = req.body;
            
            // Mini App မှ Direct Message လက်ခံရန်
            if (body && body.action === 'send_admin_msg') {
                const uId = body.userId;
                const userMsg = body.message;
                
                await bot.telegram.sendMessage(adminChatId, `📩 **Mini App မှ Direct Message**\n\n🆔 User ID: \`${uId}\`\n💬 စာသား: ${userMsg}`, {
                    parse_mode: 'Markdown'
                });
                return res.status(200).json({ success: true });
            }

            // Ads watched action
            if (body && body.action === 'watched_ad') {
                const uId = body.userId;
                global.dbPoints[uId] = (global.dbPoints[uId] || 0) + 10;
                return res.status(200).json({ success: true, points: global.dbPoints[uId] });
            }

            await bot.handleUpdate(body);
            return res.status(200).json({ status: 'ok' });
        } else {
            return res.status(200).send('Telegram Bot Server is running successfully!');
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
