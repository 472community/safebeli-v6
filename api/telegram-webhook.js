/**
 * 텔레그램 봇 웹훅.
 *
 * SNS 글에 붙은 링크는 https://t.me/<bot>?start=ig_<postid> 형태다.
 * 사용자가 그 링크로 들어오면 텔레그램이 "/start ig_<postid>" 를 이 웹훅으로 보낸다.
 * → 어느 SNS, 어느 글에서 들어온 유입인지 사람 단위로 기록된다.
 *
 * 필요한 환경변수:
 *   TELEGRAM_BOT_TOKEN        봇 토큰
 *   TELEGRAM_WEBHOOK_SECRET   웹훅 검증용 임의 문자열
 *   SUPABASE_URL, SUPABASE_SECRET_KEY
 *   TELEGRAM_CHANNEL_URL      (선택) 안내 메시지에 넣을 채널 링크
 *
 * 웹훅 등록 (한 번만):
 *   curl -F "url=https://<도메인>/api/telegram-webhook" \
 *        -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
 *        "https://api.telegram.org/bot<TOKEN>/setWebhook"
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

  const update = req.body || {};
  const msg = update.message;

  // 텔레그램은 200 이 아니면 계속 재시도한다. 처리 실패해도 200 으로 닫는다.
  if (!msg || !msg.text) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = String(msg.text).trim();

  if (text.startsWith('/start')) {
    const source = text.split(/\s+/)[1] || 'direct';

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/telegram_leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'resolution=ignore-duplicates'
          },
          body: JSON.stringify({
            telegram_id: String(msg.from.id),
            username: msg.from.username || null,
            first_name: msg.from.first_name || null,
            source,
            created_at: new Date().toISOString()
          })
        });
      } catch (e) {
        // 기록 실패가 사용자 응답을 막지 않게 한다.
      }
    }

    const channel = process.env.TELEGRAM_CHANNEL_URL;
    const welcome = [
      '👋 Selamat datang di *SafeBeli*!',
      '',
      'Kirim link toko/produk apa pun ke sini, dan AI akan menilai keamanannya.',
      channel ? `\n📢 Channel: ${channel}` : ''
    ].join('\n');

    if (TOKEN) {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: welcome, parse_mode: 'Markdown' })
      });
    }
  }

  return res.status(200).json({ ok: true });
};
