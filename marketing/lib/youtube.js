'use strict';
const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const { api, form } = require('./util');

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
 * @param {{text:string, video:string, title?:string, tags?:string[], privacy?:string}} post
 *   video: 로컬 파일 경로 (리포 루트 기준 상대경로 허용)
 */
async function publish({ text, video, title, tags = [], privacy = 'public' }) {
  if (!video) throw new Error('YouTube는 video(로컬 파일 경로)가 필요합니다');
  const file = path.isAbsolute(video) ? video : path.join(__dirname, '..', '..', video);
  if (!fs.existsSync(file)) throw new Error(`영상 파일 없음: ${file}`);

  const token = await accessToken();
  const meta = {
    snippet: {
      title: (title || text.split('\n')[0]).slice(0, 100),
      description: text.slice(0, 5000),
      tags: tags.slice(0, 30),
      categoryId: '22'
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false }
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
  const stat = fs.statSync(file);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': String(stat.size), 'Content-Type': 'video/*' },
    body: fs.createReadStream(file),
    duplex: 'half'
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`업로드 실패: ${res.status} ${JSON.stringify(body)}`);

  return { id: body.id, url: `https://youtu.be/${body.id}` };
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
