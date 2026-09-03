#!/usr/bin/env node
'use strict';
/**
 * 스레드 토큰 도우미.
 *
 * 스레드는 처음 받는 토큰이 1시간짜리 단기 토큰이라, 60일짜리 장기 토큰으로
 * 한 번 교환해야 한다. 이 교환과 사용자 ID 조회를 한 번에 처리한다.
 *
 *   node marketing/threads-token.js --exchange <단기토큰>
 *       → 장기 토큰(60일) + THREADS_USER_ID 출력
 *
 *   node marketing/threads-token.js --refresh
 *       → .env 의 장기 토큰을 60일 더 연장한 새 토큰 출력
 *
 *   node marketing/threads-token.js --expiry
 *       → 지금 토큰이 언제 만료되는지 확인
 *
 * --exchange 에는 THREADS_APP_SECRET 이 필요하다 (Meta 앱 > 설정 > 기본 > 앱 시크릿 코드).
 */
const { config } = require('./lib/config');
const { api } = require('./lib/util');
const { C } = require('./lib/util');

const BASE = 'https://graph.threads.net';

function days(seconds) {
  return Math.round(seconds / 86400);
}

async function exchange(shortToken) {
  if (!config.threads.appSecret) {
    throw new Error('THREADS_APP_SECRET 이 필요합니다 (Meta 앱 > 설정 > 기본 > 앱 시크릿 코드).');
  }
  const r = await api(
    `${BASE}/access_token?grant_type=th_exchange_token` +
      `&client_secret=${encodeURIComponent(config.threads.appSecret)}` +
      `&access_token=${encodeURIComponent(shortToken)}`
  );
  const me = await api(`${BASE}/v1.0/me?fields=id,username&access_token=${r.access_token}`);

  console.log(C.green(`\n@${me.username} 확인됨. 유효기간 ${days(r.expires_in)}일\n`));
  console.log(C.bold('아래 두 줄을 marketing/.env 에 넣으세요:\n'));
  console.log(`THREADS_USER_ID=${me.id}`);
  console.log(`THREADS_ACCESS_TOKEN=${r.access_token}`);
  console.log(
    C.gray('\n같은 값을 GitHub repo secrets 에도 넣어야 자동 발행이 됩니다.')
  );
}

async function refresh() {
  if (!config.threads.accessToken) throw new Error('THREADS_ACCESS_TOKEN 이 없습니다.');
  const r = await api(
    `${BASE}/refresh_access_token?grant_type=th_refresh_token` +
      `&access_token=${encodeURIComponent(config.threads.accessToken)}`
  );
  console.log(C.green(`\n연장 완료. 유효기간 ${days(r.expires_in)}일\n`));
  console.log(`THREADS_ACCESS_TOKEN=${r.access_token}`);
  console.log(C.gray('\n.env 와 GitHub repo secrets 양쪽을 바꿔주세요.'));
}

async function expiry() {
  if (!config.threads.accessToken) throw new Error('THREADS_ACCESS_TOKEN 이 없습니다.');
  const r = await api(
    `${BASE}/v1.0/me?fields=id,username&access_token=${config.threads.accessToken}`
  );
  console.log(C.green(`@${r.username} — 토큰 살아 있음`));
  console.log(
    C.gray('정확한 만료일은 Meta 앱 대시보드에서 확인하세요. 60일마다 --refresh 로 연장하면 됩니다.')
  );
}

(async () => {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--exchange');

  if (i >= 0) return exchange(argv[i + 1]);
  if (argv.includes('--refresh')) return refresh();
  if (argv.includes('--expiry')) return expiry();

  console.log(
    [
      '스레드 토큰 도우미',
      '',
      '  node marketing/threads-token.js --exchange <단기토큰>   단기 → 장기(60일) 교환 + 사용자 ID 조회',
      '  node marketing/threads-token.js --refresh              장기 토큰 60일 연장',
      '  node marketing/threads-token.js --expiry               토큰이 아직 살아 있는지 확인'
    ].join('\n')
  );
})().catch((e) => {
  console.error(C.red(e.message));
  process.exit(1);
});
