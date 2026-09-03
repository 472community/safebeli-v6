'use strict';
const { config } = require('./config');
const { api, form, sleep } = require('./util');
const media = require('./media');

const base = () => `https://graph.threads.net/${config.threads.apiVersion}`;

/**
 * Threads 발행은 2단계다.
 *  1) 컨테이너 생성 (/{user}/threads)
 *  2) 발행 (/{user}/threads_publish)
 * 영상은 인코딩이 끝날 때까지 기다렸다가 발행해야 한다.
 */
async function publish(post) {
  const { userId, accessToken } = config.threads;
  const text = (post.text || '').slice(0, 500); // Threads 본문 상한 500자
  const video = media.videoUrl(post);
  const image = media.imageUrls(post)[0];

  const mediaType = video ? 'VIDEO' : image ? 'IMAGE' : 'TEXT';

  const create = await api(`${base()}/${userId}/threads`, {
    method: 'POST',
    body: form({
      media_type: mediaType,
      text,
      video_url: video,
      image_url: video ? '' : image,
      access_token: accessToken
    })
  });

  if (mediaType === 'TEXT') {
    await sleep(Number(process.env.THREADS_PUBLISH_DELAY_MS || 8000));
  } else {
    await waitReady(create.id, accessToken, mediaType === 'VIDEO' ? 60 : 20);
  }

  const published = await publishWithRetry(userId, create.id, accessToken);
  return { id: published.id, url: await permalink(published.id, accessToken) };
}

async function waitReady(containerId, accessToken, tries) {
  for (let i = 0; i < tries; i++) {
    const s = await api(
      `${base()}/${containerId}?fields=status,error_message&access_token=${accessToken}`
    );
    if (s.status === 'FINISHED') return;
    if (s.status === 'ERROR') throw new Error(`컨테이너 처리 실패: ${s.error_message || 'ERROR'}`);
    await sleep(5000);
  }
  throw new Error('컨테이너가 시간 내 준비되지 않음 (영상 URL 공개 여부 및 규격 확인)');
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

async function permalink(id, accessToken) {
  try {
    const r = await api(`${base()}/${id}?fields=permalink&access_token=${accessToken}`);
    return r.permalink || null;
  } catch (e) {
    return null;
  }
}

async function check() {
  const me = await api(
    `${base()}/${config.threads.userId}?fields=username&access_token=${config.threads.accessToken}`
  );
  return `@${me.username}`;
}

module.exports = { publish, check };
