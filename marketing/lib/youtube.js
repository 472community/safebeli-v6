'use strict';
const fs = require('fs');
const { config } = require('./config');
const { api, form } = require('./util');
const media = require('./media');

/**
 * YouTube Data API v3 업로드 (Shorts 포함 — 세로 60초 이하 영상이면 자동으로 Shorts 처리).
 * 커뮤니티 게시물(텍스트 포스트)은 공개 API가 없어 자동화 불가 → 수동 영역.
 */
async function accessToken() {
  const t = await api('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: form({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      refresh_token: config.youtube.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  return t.access_token;
}

/**
 * 영상 업로드. 세로 3분 이하 영상은 유튜브가 자동으로 Shorts 로 처리한다.
 * 영상은 큐의 video(로컬 경로) 또는 videoUrl(공개 주소) 어느 쪽이든 된다.
 */
async function publish(post) {
  const { file, cleanup } = await media.videoFile(post);
  try {
    const token = await accessToken();

    let description = (post.text || '').slice(0, 4900);
    if (post.shorts !== false && !/#shorts/i.test(description)) {
      description = `${description}\n\n#Shorts`;
    }

    const meta = {
      snippet: {
        title: (post.title || (post.text || '').split('\n')[0]).slice(0, 100),
        description,
        tags: (post.tags || []).slice(0, 30),
        categoryId: '22'
      },
      status: {
        privacyStatus: post.privacy || 'public',
        selfDeclaredMadeForKids: false
      }
    };

    // 1) resumable 세션 시작
    const start = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*'
        },
        body: JSON.stringify(meta)
      }
    );
    if (!start.ok) throw new Error(`업로드 세션 실패: ${start.status} ${await start.text()}`);
    const uploadUrl = start.headers.get('location');
    if (!uploadUrl) throw new Error('업로드 URL을 받지 못했습니다');

    // 2) 본문 업로드
    const size = fs.statSync(file).size;
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Length': String(size), 'Content-Type': 'video/*' },
      body: fs.createReadStream(file),
      duplex: 'half'
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`업로드 실패: ${res.status} ${JSON.stringify(body)}`);

    return { id: body.id, url: `https://youtu.be/${body.id}` };
  } finally {
    cleanup();
  }
}

async function check() {
  const token = await accessToken();
  const r = await api(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const ch = r.items && r.items[0];
  if (!ch) throw new Error('채널을 찾을 수 없음');
  return `${ch.snippet.title} (구독자 ${ch.statistics.subscriberCount ?? '?'})`;
}

module.exports = { publish, check };
