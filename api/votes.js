import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const votes = await kv.hgetall('votes') || {};
    // Convert string values to numbers
    const result = {};
    for (const [k, v] of Object.entries(votes)) {
      result[k] = parseInt(v) || 0;
    }
    res.status(200).json(result);
  } catch (err) {
    console.error('votes GET error:', err);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
}
