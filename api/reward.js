const DAILY_AD_LIMIT = 20;
const AD_REWARD_POINTS = 15;

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Missing Upstash Redis URL or Token in environment variables");
  }
  return { url: url.replace(/\/+$/, ""), token };
}

async function redisCmd(...args) {
  const { url, token } = getRedisConfig();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Redis HTTP error ${res.status}`);
  }
  return data.result;
}

export default async (req, res) => {
  try {
    const userid = req.query.userid || req.query.userId || req.query.user_id;

    if (!userid) {
      return res.status(400).json({ success: false, error: "Missing userid" });
    }

    const stringUserId = userid.toString();
    const userKey = `user:${stringUserId}:points`;
    const lastAdKey = `user:${stringUserId}:last_ad`;
    const today = getTodayDateStr();
    const dailyAdKey = `user:${stringUserId}:ads:${today}`;

    const currentAds = parseInt(await redisCmd("GET", dailyAdKey), 10) || 0;
    if (currentAds >= DAILY_AD_LIMIT) {
      const cur = await redisCmd("GET", userKey);
      return res.status(200).json({
        success: true,
        points: parseInt(cur || 0, 10),
        todayAds: currentAds,
        dailyAdLimit: DAILY_AD_LIMIT,
        limitReached: true,
      });
    }

    const lastAd = await redisCmd("GET", lastAdKey);
    const now = Date.now();
    if (lastAd && (now - parseInt(lastAd, 10)) < 10000) {
      const cur = await redisCmd("GET", userKey);
      return res.status(200).json({
        success: true,
        points: parseInt(cur || 0, 10),
        todayAds: currentAds,
        dailyAdLimit: DAILY_AD_LIMIT,
      });
    }

    await redisCmd("SET", lastAdKey, now);
    const nextAds = await redisCmd("INCR", dailyAdKey);
    await redisCmd("EXPIRE", dailyAdKey, 86400);

    const points = await redisCmd("INCRBY", userKey, AD_REWARD_POINTS);

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
