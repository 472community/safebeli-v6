'use strict';
const { config } = require('./config');
const { api, form } = require('./util');
const media = require('./media');

const base = () => `https://api.telegram.org/bot${config.telegram.botToken}`;

/** 텔레그램 채널/그룹에 발행. 이미지가 있으면 sendPhoto, 없으면 sendMessage. */
async function publish(post) {
  const text = post.text || '';
  const chat_id = config.telegram.chatId;
  const photo = media.imageUrls(post)[0];

  if (photo) {
    // 캡션 상한 1024자. 초과분은 후속 메시지로 분리.
    const caption = text.slice(0, 1024);
    const rest = text.slice(1024);
    const r = await api(`${base()}/sendPhoto`, {
      method: 'POST',
      body: form({ chat_id, photo, caption, parse_mode: 'HTML' })
    });
    if (rest.trim()) {
      await api(`${base()}/sendMessage`, {
        method: 'POST',
        body: form({ chat_id, text: rest, parse_mode: 'HTML' })
      });
    }
    return { id: String(r.result.message_id), url: permalink(r.result) };
  }

  const r = await api(`${base()}/sendMessage`, {
    method: 'POST',
    body: form({ chat_id, text: text.slice(0, 4096), parse_mode: 'HTML' })
  });
  return { id: String(r.result.message_id), url: permalink(r.result) };
}

function permalink(msg) {
  const uname = msg && msg.chat && msg.chat.username;
  return uname ? `https://t.me/${uname}/${msg.message_id}` : null;
}

/** 자격증명/채널 접근 확인 */
async function check() {
  const me = await api(`${base()}/getMe`);
  const chat = await api(`${base()}/getChat?chat_id=${encodeURIComponent(config.telegram.chatId)}`);
  return `bot @${me.result.username} → ${chat.result.title || chat.result.username || chat.result.id}`;
}

module.exports = { publish, check };
