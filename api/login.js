const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

  try {
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      { headers }
    );
    const users = await userRes.json();
    if (!users.length) return res.status(401).json({ error: 'Email atau password salah' });

    const user = users[0];
    const [salt, storedHash] = user.password_hash.split(':');
    const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
    if (hash !== storedHash) return res.status(401).json({ error: 'Email atau password salah' });

    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ last_login: new Date().toISOString() })
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'safebeli-secret';
    const tokenData = { userId: user.id, email: user.email, ts: Date.now() };
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64') + '.' +
      crypto.createHmac('sha256', JWT_SECRET).update(JSON.stringify(tokenData)).digest('hex');

    return res.status(200).json({
      success: true, token,
      user: { id: user.id, email: user.email, is_premium: user.is_premium, premium_expires_at: user.premium_expires_at }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
