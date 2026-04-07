import { kv } from '@vercel/kv';

const MAX_VOTES = 10;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const myVotes = await kv.hgetall(`ipvotes:${ip}`) || {};
    const remaining = Math.max(0, MAX_VOTES - Object.keys(myVotes).length);
    res.status(200).json({ votes: myVotes, remaining });
  } catch (err) {
    console.error('my-votes error:', err);
    res.status(500).json({ error: 'Failed' });
  }
}
