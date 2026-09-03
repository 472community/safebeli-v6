'use strict';
const { config } = require('./config');
const brand = require('./brand');

/**
 * SNS 글에 들어갈 텔레그램 유입 링크를 만든다.
 *
 * 두 가지 방식이 있고, TELEGRAM_LINK_MODE 로 고른다.
 *
 *  channel (기본) — 채널로 바로 보낸다. 마찰이 없다.
 *      플랫폼별 초대링크가 등록돼 있으면 그걸 쓴다.
 *      → 텔레그램 채널 관리 화면에서 링크별 가입자 수가 보인다 (플랫폼 단위 측정).
 *      초대링크가 없으면 채널 대표 주소로 폴백한다 (측정 없음).
 *
 *  bot — 봇으로 보낸다. t.me/<bot>?start=<출처>
 *      한 단계 더 거치는 대신, 어느 글이 데려왔는지까지 기록된다 (글 단위 측정).
 */
const SOURCE_CODE = {
  telegram: 'tg',
  threads: 'th',
  instagram: 'ig',
  tiktok: 'tt',
  youtube: 'yt'
};

function sourceCode(platform, postId) {
  const p = SOURCE_CODE[platform] || platform;
  return `${p}_${String(postId || '').replace(/[^A-Za-z0-9_]/g, '_')}`.slice(0, 64);
}

function channelUrl() {
  if (config.telegram.channelUrl) return config.telegram.channelUrl;
  const t = brand.load().telegram || {};
  return t.channelUrl || '';
}

/** 플랫폼별 초대링크 (없으면 빈 문자열) */
function inviteLink(platform) {
  const t = brand.load().telegram || {};
  const links = t.inviteLinks || {};
  return links[platform] || '';
}

function telegramLink(platform, postId) {
  if (config.telegram.linkMode === 'bot') {
    if (!config.telegram.botUsername) {
      throw new Error(
        'TELEGRAM_LINK_MODE=bot 인데 TELEGRAM_BOT_USERNAME 이 없습니다. ' +
          '봇을 만들거나 링크 모드를 channel 로 두세요.'
      );
    }
    return `https://t.me/${config.telegram.botUsername}?start=${sourceCode(platform, postId)}`;
  }

  const invite = inviteLink(platform);
  if (invite) return invite;

  const url = channelUrl();
  if (!url) {
    throw new Error(
      '텔레그램 채널 주소가 없습니다. brand.json 의 telegram.channelUrl 또는 ' +
        'TELEGRAM_CHANNEL_URL 을 설정하세요.'
    );
  }
  return url;
}

/** 지금 설정에서 플랫폼별로 어떤 링크가 나가는지 (점검용) */
function describe() {
  return Object.keys(SOURCE_CODE)
    .filter((p) => p !== 'telegram')
    .map((p) => {
      let link;
      try {
        link = telegramLink(p, 'example-post');
      } catch (e) {
        link = `(오류: ${e.message})`;
      }
      const tracked = config.telegram.linkMode === 'bot' || !!inviteLink(p);
      return { platform: p, link, tracked };
    });
}

module.exports = { telegramLink, describe, sourceCode, channelUrl };
