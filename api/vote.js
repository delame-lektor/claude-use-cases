import { kv } from '@vercel/kv';

const MAX_VOTES_PER_IP = 10;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { useCaseId } = req.body || {};
    if (!useCaseId && useCaseId !== 0) return res.status(400).json({ error: 'Missing useCaseId' });
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const ipKey = 'ip:' + ip;
    const usedRaw = await kv.get(ipKey);
    const usedVotes = parseInt(usedRaw || '0');
    if (usedVotes >= MAX_VOTES_PER_IP) return res.status(429).json({ error: 'Dosahli jste limitu hlasu.', remaining: 0 });
    const newCount = await kv.hincrby('votes', String(useCaseId), 1);
    const newUsed = await kv.incr(ipKey);
    const remaining = MAX_VOTES_PER_IP - newUsed;
    res.status(200).json({ success: true, votes: newCount, remaining });
  } catch (err) {
    console.error('vote POST error:', err);
    res.status(500).json({ error: 'Nepodarilo se zaznamenat hlas.' });
  }
}
