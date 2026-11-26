import express from 'express';
import { Telegraf } from 'telegraf';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// CORS header
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const DAILY_AD_LIMIT = 20;
const AD_REWARD_POINTS = 15;

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN (or BOT_TOKEN)');
}

const bot = token ? new Telegraf(token) : null;

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const START_TEXT = `TG Watch - App ဖွင့်ရန် အောက်က Button ကိုနှိပ်ပါ`;

if (bot) {
  bot.start(async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      if (redis) {
        await redis.sadd('tg_watch:users', String(chatId));
      }

      const webappUrl = process.env.WEBAPP_URL || 'https://tg-watch-app.vercel.app';
      const keyboard = [[{ text: 'App ဖွင့်မယ်', web_app: { url: webappUrl } }]];
      await ctx.reply(START_TEXT, { reply_markup: { inline_keyboard: keyboard } });
    } catch (e) {
      console.error('bot.start error:', e);
      try {
        await ctx.reply(START_TEXT);
      } catch (e2) {}
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(START_TEXT);
  });
}

function verifyTelegram(initData) {
  if (!initData || !token) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (calc !== hash) return null;
    return JSON.parse(params.get('user') || '{}');
  } catch (e) {
    return null;
  }
}

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// Mini App / API POST handler
async function handleApiPost(req, res) {
  try {
    if (!redis) {
      return res.status(500).json({ success: false, error: 'Redis configuration missing' });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { action, userId, startPayload, initData, walletAddress } = body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const stringUserId = userId.toString();
    const userKey = `user:${stringUserId}:points`;
    const refCheckedKey = `user:${stringUserId}:ref_checked`;

    if (initData) {
      const tgUser = verifyTelegram(initData);
      if (!tgUser || String(tgUser.id) !== stringUserId) {
        return res.status(403).json({ success: false, error: 'Invalid Telegram data' });
      }
    }

    if (action === 'login' || action === 'get_points') {
      let points = await redis.get(userKey);
      if (points === null) {
        points = 0;
        await redis.set(userKey, points);
      }
      if (action === 'login' && startPayload) {
        const referrerId = startPayload.toString().replace('ref_', '').trim();
        const isRefChecked = await redis.get(refCheckedKey);
        if (referrerId && referrerId !== stringUserId && !isRefChecked) {
          await redis.set(refCheckedKey, 'true');
          const referrerKey = `user:${referrerId}:points`;
          let referrerPoints = await redis.get(referrerKey);
          if (referrerPoints === null) {
            referrerPoints = 100;
          } else {
            referrerPoints = parseInt(referrerPoints, 10) + 100;
          }
          await redis.set(referrerKey, referrerPoints);
        }
      }
      const finalPoints = await redis.get(userKey);
      const pending = await redis.get(`user:${stringUserId}:pending_withdraw`);
      const todayAds = parseInt(await redis.get(`user:${stringUserId}:ads:${getTodayDateStr()}`), 10) || 0;
      return res.status(200).json({
        success: true,
        points: parseInt(finalPoints || 0, 10),
        pendingWithdraw: pending ? parseInt(pending, 10) : 0,
        todayAds,
        dailyAdLimit: DAILY_AD_LIMIT,
      });
    }

    if (action === 'watched_ad') {
      const today = getTodayDateStr();
      const dailyAdKey = `user:${stringUserId}:ads:${today}`;
      const currentAds = parseInt(await redis.get(dailyAdKey), 10) || 0;

      if (currentAds >= DAILY_AD_LIMIT) {
        const cur = await redis.get(userKey);
        return res.status(200).json({
          success: true,
          points: parseInt(cur || 0, 10),
          todayAds: currentAds,
          dailyAdLimit: DAILY_AD_LIMIT,
          limitReached: true,
        });
      }

      const lastAdKey = `user:${stringUserId}:last_ad`;
      const lastAd = await redis.get(lastAdKey);
      const now = Date.now();
      if (lastAd && now - parseInt(lastAd, 10) < 10000) {
        const cur = await redis.get(userKey);
        return res.status(200).json({
          success: true,
          points: parseInt(cur || 0, 10),
          todayAds: currentAds,
          dailyAdLimit: DAILY_AD_LIMIT,
        });
      }

      await redis.set(lastAdKey, now);
      const nextAds = await redis.incr(dailyAdKey);
      await redis.expire(dailyAdKey, 86400);

      let points = await redis.get(userKey);
      if (points === null) points = 0;
      points = parseInt(points, 10) + AD_REWARD_POINTS;
      await redis.set(userKey, points);

      return res.status(200).json({
        success: true,
        points: parseInt(points, 10),
        todayAds: parseInt(nextAds, 10),
        dailyAdLimit: DAILY_AD_LIMIT,
        limitReached: parseInt(nextAds, 10) >= DAILY_AD_LIMIT,
      });
    }

    if (action === 'vpn_bonus') {
      const today = getTodayDateStr();
      const vpnKey = `user:${stringUserId}:vpn_bonus:${today}`;
      const count = parseInt(await redis.get(vpnKey)) || 0;
      if (count >= 10) {
        const cur = await redis.get(userKey);
        return res.status(200).json({ success: true, points: parseInt(cur || 0, 10), limitReached: true });
      }
      await redis.incr(vpnKey);
      await redis.expire(vpnKey, 86400);
      const points = await redis.incrby(userKey, 5);
      return res.status(200).json({ success: true, points: parseInt(points, 10), limitReached: false });
    }

    if (action === 'request_withdraw') {
      let points = await redis.get(userKey);
      points = parseInt(points || 0, 10);
      if (points < 1500) {
        return res.status(200).json({ success: false, error: 'Points မလုံလောက်ပါ' });
      }
      if (!walletAddress) {
        return res.status(200).json({ success: false, error: 'Wallet လိပ်စာ မပါပါ' });
      }
      const payMethod = body.payMethod || 'TON';
      if (!['TON', 'KPay', 'WavePay'].includes(payMethod)) {
        return res.status(200).json({ success: false, error: 'Payment Method မမှန်ပါ' });
      }
      await redis.set(userKey, 0);
      await redis.set(`user:${stringUserId}:pending_withdraw`, points);
      const withdrawId = `${Date.now()}_${stringUserId}`;
      await redis.set(
        `withdraw:${withdrawId}`,
        JSON.stringify({
          userId: stringUserId,
          walletAddress,
          payMethod,
          points,
          status: 'pending',
          createdAt: new Date().toISOString(),
        })
      );
      try {
        const adminId = process.env.ADMIN_ID;
        if (adminId && bot) {
          await bot.telegram.sendMessage(
            adminId,
            `Withdraw အသစ်!\n\nUser ID: ${stringUserId}\nMethod: ${payMethod}\nAccount: ${walletAddress}\nPoints: ${points} PTS`
          );
        }
      } catch (e) {}
      return res.status(200).json({ success: true, points: 0 });
    }

    return res.status(200).json({ status: 'received' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Unified POST handler: Telegram Webhook updates vs Mini App API calls
async function handlePost(req, res) {
  const body = req.body || {};
  const isTelegramUpdate =
    typeof body.update_id === 'number' ||
    Boolean(body.message || body.edited_message || body.callback_query || body.inline_query || body.my_chat_member || body.chat_member);

  if (isTelegramUpdate) {
    if (!bot) {
      return res.status(500).json({ ok: false, error: 'Bot token missing' });
    }
    try {
      await bot.handleUpdate(body, res);
      if (!res.headersSent) {
        res.status(200).json({ ok: true });
      }
      return;
    } catch (err) {
      console.error('Telegram webhook error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ ok: false, error: err.message });
      }
      return;
    }
  }

  return handleApiPost(req, res);
}

app.post('/', handlePost);
app.post('/api/index', handlePost);

app.get('/', (req, res) => {
  res.status(200).send('Telegram Bot Server is running!');
});

app.get('/api/index', (req, res) => {
  res.status(200).send('Telegram Bot Server is running!');
});

if (!process.env.VERCEL || process.env.ENABLE_POLLING === 'true') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    if (bot) {
      bot.launch({ dropPendingUpdates: true })
        .then(() => console.log('Telegraf bot launched'))
        .catch((err) => console.error('Bot launch error:', err));
    }
  });

  process.once('SIGINT', () => bot && bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));
}

export default app;
