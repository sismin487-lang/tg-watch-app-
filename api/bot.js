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

            let replyText = `မင်္ဂလာပါ ${userName}။ Tg Watch မှ ကြိုဆိုပါတယ်။ ကြော်ငြာကြည့်ပြီး အမှတ်များစုဆောင်းနိုင်ပါပြီ။`;

            // ဥပမာ - User က '/start' လို့ ပို့လာရင်
            if (text === '/start') {
                replyText = `မင်္ဂလာပါ ${userName} 🙏\n\n'Tg Watch' Mini App မှ ကြိုဆိုပါတယ်။ အောက်ပါခလုတ်ကိုနှိပ်၍ ဗီဒီယိုကြော်ငြာကြည့်ကာ အမှတ်များ စုဆောင်းနိုင်ပါသည်။`;
            } else if (text === '/balance') {
                replyText = `သင့်ရဲ့ လက်ကျန်အမှတ်များကို Mini App ထဲတွင် ဝင်ရောက်စစ်ဆေးနိုင်ပါသည်။`;
            } else {
                replyText = `ပေးပို့ထားသော မက်ဆေ့ခ်ျကို လက်ခံရရှိပါသည်။ Admin သို့ တိုက်ရိုက်ဆက်သွယ်လိုပါက မက်ဆေ့ခ်ျပို့ထားနိုင်ပါသည်။`;
            }

            // Telegram Bot API ကို အသုံးပြု၍ အလိုအလျောက် စာပြန်ရန် (Telegram Token လိုအပ်သည်)
            const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Vercel Environment Variables တွင် ထည့်ရန်
            if (BOT_TOKEN) {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: replyText
                    })
                });
            }
        }

        return res.status(200).json({ success: true });
    } (error) {
        console.error('Bot API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
