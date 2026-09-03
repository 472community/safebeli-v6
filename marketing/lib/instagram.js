'use strict';
const { config } = require('./config');
const { api, form, sleep } = require('./util');

const base = () => `https://graph.facebook.com/${config.instagram.apiVersion}`;

/**
 * Instagram Content Publishing API.
 * 전제: Instagram 프로페셔널(비즈니스/크리에이터) 계정 + 연결된 Facebook 페이지.
 * 이미지가 반드시 "공개 URL" 이어야 한다 → public/marketing/ 에 올리면
 * https://<사이트>/marketing/<파일> 로 그대로 쓸 수 있다.
 * 이미지 없는 텍스트 전용 게시물은 인스타그램 자체가 지원하지 않는다.
 */
async function publish({ text, media = [] }) {
  const { userId, accessToken } = config.instagram;
  if (!media.length) {
    throw new Error('Instagram은 이미지/영상이 반드시 필요합니다 (media 비어 있음)');
  }

  let creationId;
  if (media.length === 1) {
    const c = await api(`${base()}/${userId}/media`, {
      method: 'POST',
      body: form({ image_url: media[0], caption: text.slice(0, 2200), access_token: accessToken })
    });
    creationId = c.id;
  } else {
    // 캐러셀: 자식 컨테이너 → 부모 컨테이너
    const children = [];
    for (const url of media.slice(0, 10)) {
      const child = await api(`${base()}/${userId}/media`, {
        method: 'POST',
        body: form({ image_url: url, is_carousel_item: 'true', access_token: accessToken })
      });
      children.push(child.id);
    }
    const parent = await api(`${base()}/${userId}/media`, {
      method: 'POST',
      body: form({
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: text.slice(0, 2200),
        access_token: accessToken
      })
    });
    creationId = parent.id;
  }

  await waitReady(creationId, accessToken);

  const published = await api(`${base()}/${userId}/media_publish`, {
    method: 'POST',
    body: form({ creation_id: creationId, access_token: accessToken })
  });
  return { id: published.id, url: `https://www.instagram.com/p/${published.id}` };
}

async function waitReady(creationId, accessToken, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const s = await api(
      `${base()}/${creationId}?fields=status_code,status&access_token=${accessToken}`
    );
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR') throw new Error(`컨테이너 처리 실패: ${s.status || 'ERROR'}`);
    await sleep(5000);
  }
  throw new Error('컨테이너가 시간 내 준비되지 않음 (이미지 URL 공개 여부 확인)');
}

async function check() {
  const me = await api(
    `${base()}/${config.instagram.userId}?fields=username,followers_count&access_token=${config.instagram.accessToken}`
  );
  return `@${me.username} (팔로워 ${me.followers_count ?? '?'})`;
}

module.exports = { publish, check };
