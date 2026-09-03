'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { config } = require('./config');

/**
 * 플랫폼마다 영상을 받는 방식이 다르다.
 *   - 인스타 릴스: 공개 URL 만 받는다
 *   - 틱톡 / 유튜브: 파일 바이트를 직접 올린다
 * 그래서 큐에는 공개 URL(videoUrl) 하나만 적고, 파일이 필요한 곳에서는 받아서 쓴다.
 */

/** 상대 경로면 MARKETING_MEDIA_BASE_URL 을 붙여 공개 URL 로 만든다. */
function toUrl(ref) {
  if (!ref) return '';
  if (/^https?:\/\//i.test(ref)) return ref;
  if (!config.mediaBaseUrl) return '';
  return `${config.mediaBaseUrl}/${String(ref).replace(/^\//, '')}`;
}

function videoUrl(post) {
  return toUrl(post.videoUrl || (post.video && !fs.existsSync(localPath(post.video)) ? post.video : ''));
}

function imageUrls(post) {
  return (post.media || []).map(toUrl).filter(Boolean);
}

function localPath(p) {
  return path.isAbsolute(p) ? p : path.join(__dirname, '..', '..', p);
}

/**
 * 업로드용 로컬 파일 경로를 돌려준다.
 * 로컬에 파일이 있으면 그대로 쓰고, 없으면 공개 URL 에서 받아 임시 파일로 만든다.
 * @returns {Promise<{file:string, cleanup:()=>void}>}
 */
async function videoFile(post) {
  if (post.video) {
    const p = localPath(post.video);
    if (fs.existsSync(p)) return { file: p, cleanup: () => {} };
  }

  const url = videoUrl(post);
  if (!url) {
    throw new Error('영상이 없습니다 (video 로컬 경로 또는 videoUrl 공개 주소 필요)');
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`영상 내려받기 실패: ${res.status} ${url}`);

  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-')),
    (url.split('/').pop() || 'video.mp4').split('?')[0]
  );
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

  return {
    file: tmp,
    cleanup: () => {
      try {
        fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
      } catch (e) {
        /* 임시파일 정리 실패는 무시 */
      }
    }
  };
}

module.exports = { toUrl, videoUrl, imageUrls, videoFile, localPath };
