'use strict';
const { config } = require('./config');
const { api, form, sleep } = require('./util');
const media = require('./media');

const base = () => `https://graph.facebook.com/${config.instagram.apiVersion}`;

/**
 * Instagram Content Publishing API.
 * 전제: Instagram 프로페셔널(비즈니스/크리에이터) 계정 + 연결된 Facebook 페이지.
 * 이미지와 영상 모두 "공개 URL" 이어야 한다 (파일 업로드 불가).
 * 텍스트 전용 게시물은 인스타그램 자체가 지원하지 않는다.
 */
async function publish(post) {
  const { userId, accessToken } = config.instagram;
  const video = media.videoUrl(post);
  const images = media.imageUrls(post);

  let creationId;
  let isVideo = false;

  if (video) {
    // 릴스
    isVideo = true;
    const c = await api(`${base()}/${userId}/media`, {
      method: 'POST',
      body: form({
        media_type: 'REELS',
        video_url: video,
        caption: (post.text || '').slice(0, 2200),
        cover_url: images[0],
        share_to_feed: 'true',
        access_token: accessToken
      })
    });
    creationId = c.id;
  } else if (images.length === 1) {
    const c = await api(`${base()}/${userId}/media`, {
      method: 'POST',
      body: form({
        image_url: images[0],
        caption: (post.text || '').slice(0, 2200),
        access_token: accessToken
      })
    });
    creationId = c.id;
  } else if (images.length > 1) {
    // 캐러셀: 자식 컨테이너 → 부모 컨테이너
    const children = [];
    for (const url of images.slice(0, 10)) {
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
        caption: (post.text || '').slice(0, 2200),
        access_token: accessToken
      })
    });
    creationId = parent.id;
  } else {
    throw new Error(
      '인스타그램은 이미지 또는 영상이 반드시 필요합니다 (media / videoUrl 둘 다 비어 있음). ' +
        'MARKETING_MEDIA_BASE_URL 설정 여부도 확인하세요.'
    );
  }

  // 영상은 인코딩 때문에 훨씬 오래 걸린다.
  await waitReady(creationId, accessToken, isVideo ? 60 : 12);

  const published = await api(`${base()}/${userId}/media_publish`, {
    method: 'POST',
    body: form({ creation_id: creationId, access_token: accessToken })
  });
  return { id: published.id, url: await permalink(published.id, accessToken) };
}

async function permalink(id, accessToken) {
  try {
    const r = await api(`${base()}/${id}?fields=permalink&access_token=${accessToken}`);
    return r.permalink || null;
  } catch (e) {
    return null;
  }
}

async function waitReady(creationId, accessToken, tries) {
  for (let i = 0; i < tries; i++) {
    const s = await api(
      `${base()}/${creationId}?fields=status_code,status&access_token=${accessToken}`
    );
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR') throw new Error(`컨테이너 처리 실패: ${s.status || 'ERROR'}`);
    await sleep(5000);
  }
  throw new Error('컨테이너가 시간 내 준비되지 않음 (미디어 URL 공개 여부 및 규격 확인)');
}

async function check() {
  const me = await api(
    `${base()}/${config.instagram.userId}?fields=username,followers_count&access_token=${config.instagram.accessToken}`
  );
  return `@${me.username} (팔로워 ${me.followers_count ?? '?'})`;
}

module.exports = { publish, check };
