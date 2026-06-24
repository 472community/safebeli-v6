module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });

  try {
    const [dataB64] = token.split('.');
    const tokenData = JSON.parse(Buffer.from(dataB64, 'base64').toString());
    const userId = tokenData.userId;

    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/analysis_history?user_id=eq.${userId}&order=created_at.desc&limit=20&select=*`,
      { headers }
    );
    const history = await histRes.json();
    return res.status(200).json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
