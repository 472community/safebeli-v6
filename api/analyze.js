module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  const { link, token } = req.body;
  if (!link) return res.status(400).json({ error: 'Link wajib diisi' });

  let userId = null;
  let isPremium = false;

  if (token) {
    try {
      const [dataB64] = token.split('.');
      const tokenData = JSON.parse(Buffer.from(dataB64, 'base64').toString());
      userId = tokenData.userId;
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=is_premium,premium_expires_at`,
        { headers: sbHeaders }
      );
      const users = await userRes.json();
      if (users.length > 0) {
        const user = users[0];
        isPremium = user.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
      }
    } catch (e) { userId = null; }
  }

  if (!isPremium && userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/analysis_history?user_id=eq.${userId}&created_at=gte.${todayStart.toISOString()}&select=id`,
      { headers: sbHeaders }
    );
    const todayAnalyses = await countRes.json();
    if (todayAnalyses.length >= 3) {
      return res.status(429).json({ error: 'Batas harian 3x tercapai. Upgrade ke Premium!' });
    }
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Kamu adalah AI ahli keamanan belanja online Indonesia. Analisis link toko ini dan berikan penilaian keamanan.

Link: ${link}

Berikan analisis dalam format JSON berikut (HANYA JSON, tanpa teks lain):
{
  "score": <angka 0-100>,
  "status": "<AMAN|HATI-HATI|BAHAYA>",
  "summary": "<ringkasan 1-2 kalimat dalam Bahasa Indonesia>",
  "details": ["<poin 1>", "<poin 2>", "<poin 3>"]
}`
        }]
      })
    });

    const aiData = await aiRes.json();

    // API 에러 체크
    if (aiData.error) {
      return res.status(500).json({ error: 'AI error: ' + aiData.error.message });
    }

    if (!aiData.content || !aiData.content[0] || !aiData.content[0].text) {
      return res.status(500).json({ error: 'AI response invalid: ' + JSON.stringify(aiData) });
    }

    const rawText = aiData.content[0].text;
    let analysis;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch[0]);
    } catch (e) {
      analysis = {
        score: 50,
        status: 'HATI-HATI',
        summary: 'Tidak dapat menganalisis link ini secara otomatis.',
        details: ['Cek rating seller', 'Baca ulasan pembeli', 'Hindari transfer langsung']
      };
    }

    if (userId) {
      await fetch(`${SUPABASE_URL}/rest/v1/analysis_history`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          user_id: userId,
          link,
          result: analysis.summary,
          score: analysis.score,
          status: analysis.status,
          created_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
