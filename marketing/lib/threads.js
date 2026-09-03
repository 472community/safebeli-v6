'use strict';
const { config } = require('./config');
const { api, form, sleep } = require('./util');

const base = () => `https://graph.threads.net/${config.threads.apiVersion}`;

/**
 * Threads 발행은 2단계다.
 *  1) 컨테이너 생성 (/{user}/threads)
 *  2) 발행 (/{user}/threads_publish)
 * Meta 권장: 컨테이너 생성 후 약간의 대기 뒤 publish.
 */
async function publish({ text, media = [] }) {
  const { userId, accessToken } = config.threads;
  const image = media[0];

  const create = await api(`${base()}/${userId}/threads`, {
    method: 'POST',
    body: form({
      media_type: image ? 'IMAGE' : 'TEXT',
      text: text.slice(0, 500), // Threads 본문 상한 500자
      image_url: image,
      access_token: accessToken
    })
  });

  await sleep(Number(process.env.THREADS_PUBLISH_DELAY_MS || 8000));

  const published = await publishWithRetry(userId, create.id, accessToken);
  return { id: published.id, url: `https://www.threads.net/@me/post/${published.id}` };
}

async function publishWithRetry(userId, creationId, accessToken, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await api(`${base()}/${userId}/threads_publish`, {
        method: 'POST',
        body: form({ creation_id: creationId, access_token: accessToken })
      });
    } catch (e) {
      last = e; // 컨테이너가 아직 준비 전이면 잠시 후 재시도
      await sleep(5000 * (i + 1));
    }
  }
  throw last;
}

async function check() {
  const me = await api(
    `${base()}/${config.threads.userId}?fields=username&access_token=${config.threads.accessToken}`
  );
  return `@${me.username}`;
}

module.exports = { publish, check };
