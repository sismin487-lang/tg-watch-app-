import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, userId, username, referrerId } = req.body;

  try {
    if (action === 'login') {
      const userKey = `user:${userId}`;
      const existingUser = await kv.get(userKey);

      if (!existingUser) {
        await kv.set(userKey, { userId, username, points: 0, createdAt: Date.now() });

        // ဖိတ်ကြားသူ ရှိပြီး ကိုယ့်ကိုကိုယ် ပြန်မဖိတ်ထားပါက 100 PTS ပေးမည်
        if (referrerId && referrerId !== userId.toString()) {
          const referrerKey = `user:${referrerId}`;
          const referrerData = await kv.get(referrerKey);

          if (referrerData) {
            referrerData.points = (referrerData.points || 0) + 100;
            await kv.set(referrerKey, referrerData);
            await kv.set(`referred_by:${userId}`, referrerId);
          }
        }
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'watched_ad') {
      const userKey = `user:${userId}`;
      let userData = await kv.get(userKey);

      if (userData) {
        userData.points = (userData.points || 0) + 10;
        await kv.set(userKey, userData);
        return res.status(200).json({ success: true, points: userData.points });
      }
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
