'use strict';

/**
 * 모든 자격증명은 환경변수로만 읽는다. 저장소에 토큰을 커밋하지 않는다.
 * GitHub Actions 에서는 repo secrets, 로컬에서는 marketing/.env (gitignored) 사용.
 */
const fs = require('fs');
const path = require('path');

// 로컬 개발 편의: marketing/.env 가 있으면 읽어서 process.env 에 채운다.
(function loadDotEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const env = process.env;

const config = {
  // 이미지 호스팅 베이스 URL (인스타는 공개 URL 이미지만 받는다)
  mediaBaseUrl: (env.MARKETING_MEDIA_BASE_URL || '').replace(/\/$/, ''),

  // 텔레그램 신규 유입에게 자동으로 보낼 환영 메시지 (비우면 안 보냄)
  welcomeMessage: env.TELEGRAM_WELCOME_MESSAGE || '',

  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN || '',
    chatId: env.TELEGRAM_CHAT_ID || '',        // 채널: @myChannel 또는 -100xxxxxxxxxx
    botUsername: (env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
    channelUrl: env.TELEGRAM_CHANNEL_URL || '',  // 예: https://t.me/my_channel
    // 'channel'(기본) = 채널로 바로 보냄 / 'bot' = 봇을 거쳐 글 단위 유입 추적
    linkMode: (env.TELEGRAM_LINK_MODE || 'channel').toLowerCase()
  },

  threads: {
    userId: env.THREADS_USER_ID || '',
    accessToken: env.THREADS_ACCESS_TOKEN || '',
    appSecret: env.THREADS_APP_SECRET || '', // 장기 토큰 교환에만 쓴다
    apiVersion: env.THREADS_API_VERSION || 'v1.0'
  },

  instagram: {
    userId: env.IG_USER_ID || '',              // Instagram Business/Creator 계정 ID
    accessToken: env.IG_ACCESS_TOKEN || '',    // Facebook 장기 토큰
    apiVersion: env.IG_API_VERSION || 'v21.0'
  },

  tiktok: {
    clientKey: env.TIKTOK_CLIENT_KEY || '',
    clientSecret: env.TIKTOK_CLIENT_SECRET || '',
    refreshToken: env.TIKTOK_REFRESH_TOKEN || '',
    // 앱 심사 전에는 SELF_ONLY(비공개)만 허용된다. 심사 후 PUBLIC_TO_EVERYONE 로 바꾼다.
    privacyLevel: env.TIKTOK_PRIVACY_LEVEL || ''
  },

  youtube: {
    clientId: env.YT_CLIENT_ID || '',
    clientSecret: env.YT_CLIENT_SECRET || '',
    refreshToken: env.YT_REFRESH_TOKEN || ''
  }
};

const READY = {
  telegram: () => !!(config.telegram.botToken && config.telegram.chatId),
  threads: () => !!(config.threads.userId && config.threads.accessToken),
  instagram: () => !!(config.instagram.userId && config.instagram.accessToken),
  tiktok: () =>
    !!(config.tiktok.clientKey && config.tiktok.clientSecret && config.tiktok.refreshToken),
  youtube: () =>
    !!(config.youtube.clientId && config.youtube.clientSecret && config.youtube.refreshToken)
};

function isReady(platform) {
  const f = READY[platform];
  return f ? f() : false;
}

function readyPlatforms() {
  return Object.keys(READY).filter(isReady);
}

module.exports = { config, isReady, readyPlatforms };
