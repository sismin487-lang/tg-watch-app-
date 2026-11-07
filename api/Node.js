// ၁။ User က Bot ဆီ စာပို့လိုက်သည့်အခါ Admin ဆီသို့ Forward လုပ်ပေးခြင်း
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const adminChatId = '7120292163'; // သင့်ရဲ့ Admin Telegram ID[span_1](start_span)[span_1](end_span)

  // Admin ဆီက ပို့တာမဟုတ်ရင် နှင့် Command တွေ မဟုတ်ရင် User ပို့သမျှကို Admin ဆီ ပို့မည်
  if (chatId.toString() !== adminChatId && !msg.text?.startsWith('/')) {
    const userName = msg.from.first_name || 'User';
    
    await bot.sendMessage(adminChatId, ` **မက်ဆေ့ခ်ျအသစ် ရောက်ရှိပါသည်**\n\n အမည်: ${userName}\n ID: \`${chatId}\`\n\n စာသား: ${msg.text}`, {
      parse_mode: 'Markdown'
    });
    
    // User ဘက်ကိုလည်း ပို့ပြီးကြောင်း အကြောင်းပြန်ရန်
    bot.sendMessage(chatId, " သင့်မက်ဆေ့ခ်ျကို Admin ထံ ပို့ပြီးပါပြီ။ အမြန်ဆုံး အကြောင်းပြန်ပါမည်။");
  }
});

// ၂။ Admin ဘက်က User ထံ ပြန်စာပို့ရန် (Command: /reply [UserId] [Message])
// ဥပမာ - /reply 123456789 မင်္ဂလာပါ ဖြေကြားစရာရှိသည်များကို မေးနိုင်ပါတယ်
bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  const adminChatId = '7120292163'; //[span_2](start_span)[span_2](end_span)
  
  // Admin ဟုတ်မဟုတ် စစ်ဆေးခြင်း
  if (msg.chat.id.toString() !== adminChatId) {
    return bot.sendMessage(msg.chat.id, " ဤ Command ကို Admin သာ အသုံးပြုနိုင်ပါသည်။");
  }

  const targetUserId = match[1]; // စာပို့မည့် User ၏ Telegram ID
  const replyText = match[2];     // Admin ပြောမည့် စာသား

  try {
    // Target User ထံသို့ Admin ၏ ပြန်စာကို ပို့ခြင်း
    await bot.sendMessage(targetUserId, ` **Admin မှ အကြောင်းပြန်ကြားချက်:**\n\n${replyText}`, { 
      parse_mode: 'Markdown' 
    });
    
    // Admin ဆီကို အောင်မြင်ကြောင်း အကြောင်းပြန်ခြင်း
    bot.sendMessage(adminChatId, ` User (\`${targetUserId}\`) ထံသို့ စာပို့ပြီးပါပြီ။`, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(adminChatId, ` စာပို့၍မရပါ။ (User သည် Bot ကို Block ထားခြင်း သို့မဟုတ် Chat ဖွင့်မထားခြင်း ဖြစ်နိုင်သည်)`);
  }
});
