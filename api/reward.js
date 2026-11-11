import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

    // If called again within 10 seconds, do not add again (same as in index.js)
    const lastAd = await redis.get(lastAdKey);
    const now = Date.now();
    if (lastAd && (now - parseInt(lastAd, 10)) < 10000) {
      const cur = await redis.get(userKey);
      return res.status(200).json({ success: true, points: parseInt(cur || 0, 10) });
    }

    await redis.set(lastAdKey, now);

    // Add +15 Points - same as watched_ad
    const points = await redis.incrby(userKey, 15);

    console.log(`Reward +15 for user ${stringUserId}, total: ${points}`);

    return res.status(200).json({ success: true, points: parseInt(points, 10) });
  } catch (error) {
    console.error("Reward error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
