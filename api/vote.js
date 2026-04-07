import { kv } from '@vercel/kv';

const MAX_VOTES = 10;
const TTL = 30 * 24 * 3600; // 30 days in seconds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { useCaseId, direction, email } = req.body || {};

    if (useCaseId == null) return res.status(400).json({ error: 'Missing useCaseId' });
    if (direction !== 'up' && direction !== 'down') return res.status(400).json({ error: 'Invalid direction' });
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const ipVotesKey = `ipvotes:${ip}`;
    const idStr = String(useCaseId);

    // Save email (fire and forget)
    kv.hset('emails', { [email]: `${ip}:${Date.now()}` }).catch(() => {});

    const existing = await kv.hget(ipVotesKey, idStr);

    let delta = 0;
    let newVote = null;

    if (existing === direction) {
      // Same direction → toggle off (remove vote)
      await kv.hdel(ipVotesKey, idStr);
      delta = direction === 'up' ? -1 : 1;
      newVote = null;
    } else if (existing) {
      // Different direction → change vote (no slot consumed)
      await kv.hset(ipVotesKey, { [idStr]: direction });
      delta = direction === 'up' ? 2 : -2;
      newVote = direction;
    } else {
      // New vote — check limit
      const used = await kv.hlen(ipVotesKey);
      if (used >= MAX_VOTES) {
        return res.status(429).json({ error: 'Dosáhli jste limitu hlasů (10 use cases).', remaining: 0 });
      }
      await kv.hset(ipVotesKey, { [idStr]: direction });
      delta = direction === 'up' ? 1 : -1;
      newVote = direction;
    }

    // Refresh TTL on every vote action
    await kv.expire(ipVotesKey, TTL);

    const newCount = await kv.hincrby('votes', idStr, delta);
    const usedAfter = await kv.hlen(ipVotesKey);
    const remaining = Math.max(0, MAX_VOTES - usedAfter);

    res.status(200).json({ success: true, votes: newCount, userVote: newVote, remaining });
  } catch (err) {
    console.error('vote error:', err);
    res.status(500).json({ error: 'Nepodařilo se zaznamenat hlas.' });
  }
}
