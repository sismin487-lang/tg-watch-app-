export default async function handler(req, res) {
    // CORS Headers ခွင့်ပြုရန်
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
        const update = req.body;

        // Telegram က ပို့လိုက်သော Message ရှိမရှိ စစ်ဆေးခြင်း
        if (update && update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const userName = update.message.from.first_name || 'User';

            let replyText = `မင်္ဂလာပါ ${userName}။ Tg Watch မှ ကြိုဆိုပါတယ်။ အောက်ပါခလုတ်ကိုနှိပ်၍ Mini App ကို ဖွင့်ပါ။`;
            let replyMarkup = undefined;

            // User က '/start' လို့ ပို့လာရင်
            if (text === '/start') {
                replyText = `မင်္ဂလာပါ ${userName} 🙏\n\n'Tg Watch' Mini App မှ ကြိုဆိုပါတယ်။ အောက်ပါခလုတ်ကိုနှိပ်၍ Mini App ကို ဖွင့်လှစ်နိုင်ပါသည်။`;
                replyMarkup = {
                    inline_keyboard: [
                        [
                            {
                                text: ' Open Tg Watch App',
                                web_app: { url: 'https://tg-watch-app-t6brx8e17-sismin487-1940.vercel.app' }
                            }
                        ]
                    ]
                };
            } else if (text === '/balance') {
                replyText = `သင့်ရဲ့ လက်ကျန်အမှတ်များကို Mini App ထဲတွင် ဝင်ရောက်စစ်ဆေးနိုင်ပါသည်။`;
            } else {
                replyText = `ပေးပို့ထားသော မက်ဆေ့ခ်ျကို လက်ခံရရှိပါသည်။`;
            }

            // Telegram Bot API ကို အသုံးပြု၍ အလိုအလျောက် စာပြန်ရန်
            const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
            if (BOT_TOKEN) {
                const payload = {
                    chat_id: chatId,
                    text: replyText
                };

                if (replyMarkup) {
                    payload.reply_markup = replyMarkup;
                }

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Bot API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
