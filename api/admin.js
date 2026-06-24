module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ADMIN_KEY = process.env.ADMIN_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const usersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,email,is_premium,premium_expires_at,created_at,last_login&order=created_at.desc`,
        { headers }
      );
      const users = await usersRes.json();
      return res.status(200).json({ success: true, users });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { email, months = 1 } = req.body;
    if (!email) return res.status(400).json({ error: 'Email diperlukan' });
    try {
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
        { headers }
      );
      const users = await userRes.json();
      if (!users.length) return res.status(404).json({ error: 'User tidak ditemukan' });

      const userId = users[0].id;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_premium: true, premium_expires_at: expiresAt.toISOString() })
      });

      await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, amount: 65000 * months, method: 'whatsapp', status: 'completed', notes: `Premium ${months} bulan`, created_at: new Date().toISOString() })
      });

      return res.status(200).json({ success: true, message: `Premium aktif sampai ${expiresAt.toLocaleDateString('id-ID')}` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
