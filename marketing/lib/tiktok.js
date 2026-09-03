'use strict';
const fs = require('fs');
const { config } = require('./config');
const { api, form, sleep, C } = require('./util');
const media = require('./media');

const API = 'https://open.tiktokapis.com/v2';

async function accessToken() {
  const t = await api(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.tiktok.refreshToken
    })
  });
  if (!t.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(t)}`);
  return t.access_token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };
}

/**
 * 크리에이터 정보 조회. 틱톡은 게시 전 이 호출을 요구하고,
 * 여기서 돌려주는 privacy_level 목록 밖의 값을 쓰면 거부된다.
 * (앱 심사 전에는 SELF_ONLY = 비공개 만 허용된다)
 */
async function creatorInfo(token) {
  const r = await api(`${API}/post/publish/creator_info/query/`, {
    method: 'POST',
    headers: auth(token)
  });
  return r.data || {};
}

function pickPrivacy(info, wanted) {
  const allowed = info.privacy_level_options || [];
  if (!allowed.length) return wanted || 'SELF_ONLY';
  if (wanted && allowed.includes(wanted)) return wanted;
  // 공개 게시가 가능하면 공개를, 아니면 허용된 첫 값을 쓴다.
  return allowed.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : allowed[0];
}

const MB = 1024 * 1024;

/** 틱톡 청크 규칙: 최소 5MB, 최대 64MB. 마지막 청크가 나머지를 흡수한다. */
function chunkPlan(size) {
  if (size <= 64 * MB) return { chunk_size: size, total_chunk_count: 1 };
  const chunk_size = 10 * MB;
  return { chunk_size, total_chunk_count: Math.floor(size / chunk_size) };
}

async function publish(post) {
  const token = await accessToken();
  const info = await creatorInfo(token);
  const privacy = pickPrivacy(info, config.tiktok.privacyLevel);

  if (privacy === 'SELF_ONLY') {
    console.log(
      C.yellow('    틱톡: 앱 심사 전이라 비공개(SELF_ONLY)로만 올라갑니다. 앱에서 직접 공개 전환 필요.')
    );
  }

  const { file, cleanup } = await media.videoFile(post);
  try {
    const size = fs.statSync(file).size;
    const plan = chunkPlan(size);

    const init = await api(`${API}/post/publish/video/init/`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        post_info: {
          title: (post.title || post.text || '').slice(0, 2200),
          privacy_level: privacy,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false
        },
        source_info: { source: 'FILE_UPLOAD', video_size: size, ...plan }
      })
    });

    const { publish_id, upload_url } = init.data || {};
    if (!publish_id || !upload_url) throw new Error(`업로드 세션 실패: ${JSON.stringify(init)}`);

    await uploadChunks(upload_url, file, size, plan);
    const status = await waitPublished(token, publish_id);

    return {
      id: publish_id,
      url: status.public_post_id ? `https://www.tiktok.com/video/${status.public_post_id}` : null
    };
  } finally {
    cleanup();
  }
}

async function uploadChunks(uploadUrl, file, size, plan) {
  const fd = fs.openSync(file, 'r');
  try {
    for (let i = 0; i < plan.total_chunk_count; i++) {
      const start = i * plan.chunk_size;
      const last = i === plan.total_chunk_count - 1;
      const end = last ? size - 1 : start + plan.chunk_size - 1;
      const len = end - start + 1;

      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(len),
          'Content-Range': `bytes ${start}-${end}/${size}`
        },
        body: buf
      });
      if (!res.ok && res.status !== 201 && res.status !== 206) {
        throw new Error(`청크 ${i + 1}/${plan.total_chunk_count} 업로드 실패: ${res.status}`);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

async function waitPublished(token, publishId, tries = 30) {
  let last = {};
  for (let i = 0; i < tries; i++) {
    const r = await api(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ publish_id: publishId })
    });
    last = (r.data || {});
    if (last.status === 'PUBLISH_COMPLETE') return last;
    if (last.status === 'FAILED') {
      throw new Error(`게시 실패: ${last.fail_reason || JSON.stringify(last)}`);
    }
    await sleep(5000);
  }
  // 처리 중이어도 업로드 자체는 끝난 상태다. 중복 업로드를 막기 위해 성공으로 본다.
  return last;
}

async function check() {
  const token = await accessToken();
  const info = await creatorInfo(token);
  const levels = (info.privacy_level_options || []).join(', ') || '알 수 없음';
  return `@${info.creator_username || '?'} (게시 가능 범위: ${levels})`;
}

module.exports = { publish, check };
