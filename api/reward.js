import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DAILY_AD_LIMIT = 20;
const AD_REWARD_POINTS = 15;

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async (req, res) => {
  try {
    // Adsgram sends ?userid=123
    // Sometimes it can be userid / userId / user_id, so catch all 3 types
    const userid = req.query.userid || req.query.userId || req.query.user_id;

    if (!userid) {
      return res.status(400).json({ success: false, error: "Missing userid" });
    }

    const stringUserId = userid.toString();
    const userKey = `user:${stringUserId}:points`;
    const lastAdKey = `user:${stringUserId}:last_ad`;
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

    // If called again within 10 seconds, do not add again (same as in index.js)
    const lastAd = await redis.get(lastAdKey);
    const now = Date.now();
    if (lastAd && (now - parseInt(lastAd, 10)) < 10000) {
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

    // Add +15 Points - same as watched_ad
    const points = await redis.incrby(userKey, AD_REWARD_POINTS);

    console.log(`Reward +${AD_REWARD_POINTS} for user ${stringUserId}, total: ${points}, ads today: ${nextAds}/${DAILY_AD_LIMIT}`);

    return res.status(200).json({
      success: true,
      points: parseInt(points, 10),
      todayAds: parseInt(nextAds, 10),
      dailyAdLimit: DAILY_AD_LIMIT,
      limitReached: parseInt(nextAds, 10) >= DAILY_AD_LIMIT,
    });
  } catch (error) {
    console.error("Reward error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
