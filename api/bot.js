import TelegramBot from 'node-telegram-bot-api';

// ၁။ သင့်ရဲ့ Bot Token (ပေးထားသည့်အတိုင်း)
const token = '9296311020:AAGDaznc2OjdmhmJ010gI4nNu00EzOrrLfA';
const bot = new TelegramBot(token, { polling: true });

// ၂။ သင့်ရဲ့ Telegram User ID ကို Admin အဖြစ် သတ်မှတ်ခြင်း (ပုံထဲပါသည့် ID)
const ADMIN_ID = 52504489;[span_2](start_span)[span_2](end_span)

console.log(" Telegram Bot အောင်မြင်စွာ စတင် Run နေပါပြီ...");

// ၃။ /start command နှင့် Mini App ဖွင့်ရန် ခလုတ်ပေးခြင်း
bot.onText(/\/start(?:\s+ref_(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1]; // Ref ဖြင့် ဝင်လာပါက ဖမ်းယူရန်

  if (referrerId) {
    console.log(`User ${chatId} သည် Referrer ${referrerId} ၏ လင့်ခ်မှ ဝင်လာပါသည်။`);
  }

  // Mini App ဖွင့်ရန် Button ပို့ပေးခြင်း (သင့် Vercel Link ကို ဤနေရာတွင် ထည့်ပါ)
  bot.sendMessage(chatId, "ကြိုဆိုပါတယ်! အောက်ပါ Button ကိုနှိပ်ပြီး Mini App ကို ဖွင့်ပါ ", {
    reply_markup: {
      inline_keyboard: [
        [{ text: " Open Watch Ads App", web_app: { url: "https://your-vercel-domain.app" } }]
      ]
    }
  });
});

// ၄။ User များက Bot ထဲသို့ စာပို့လာပါက Admin ဆီသို့ တိုက်ရိုက် Forward လုပ်ပေးခြင်း
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  // Admin ကိုယ်တိုင်ပို့တာတွေနဲ့ Command တွေ မပါလျှင်
  if (chatId !== ADMIN_ID && !msg.text?.startsWith('/')) {
    const userName = msg.from.first_name || 'User';
    
    // Admin ဆီသို့ မက်ဆေ့ခ်ျ ပို့မည်
    await bot.sendMessage(ADMIN_ID, ` **မက်ဆေ့ခ်ျအသစ် ရောက်ရှိပါသည်**\n\n အမည်: ${userName}\n ID: \`${chatId}\`\n\n စာသား: ${msg.text}`, {
      parse_mode: 'Markdown'
    });
    
    // User ဘက်ကိုလည်း ပို့ပြီးကြောင်း အကြောင်းပြန်မည်
    bot.sendMessage(chatId, " သင့်မက်ဆေ့ခ်ျကို Admin ထံ ပို့ပြီးပါပြီ။ အမြန်ဆုံး အကြောင်းပြန်ပါမည်။");
  }
});

// ၅။ Admin ဘက်က User ထံ ပြန်စာပို့ရန် Command 
// အသုံးပြုပုံ (Admin Chat ထဲတွင် ရိုက်ရန်) ဥပမာ - /reply 123456789 မင်္ဂလာပါ ဘာကူညီပေးရမလဲ
bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, " ဤ Command ကို Admin သာ အသုံးပြုနိုင်ပါသည်။");
  }

  const targetUserId = match[1]; // စာပြန်မည့် User ၏ Telegram ID
  const replyText = match[2];     // Admin ပြောမည့် စာသား

  try {
    await bot.sendMessage(targetUserId, ` **Admin မှ အကြောင်းပြန်ကြားချက်:**\n\n${replyText}`, { 
      parse_mode: 'Markdown' 
    });
    bot.sendMessage(ADMIN_ID, ` User (\`${targetUserId}\`) ထံသို့ စာပို့ပြီးပါပြီ။`, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(ADMIN_ID, ` စာပို့၍မရပါ။ (User သည် Bot ကို Block ထားခြင်း ဖြစ်နိုင်သည်)`);
  }
});
