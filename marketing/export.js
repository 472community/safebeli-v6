#!/usr/bin/env node
'use strict';
/**
 * 초안을 복사해서 쓸 수 있는 평문으로 뽑는다.
 * API 연결 전에 손으로 올릴 때, 또는 검수용으로 쓴다.
 *
 *   node marketing/export.js                    화면에 출력
 *   node marketing/export.js --out 파일.txt      파일로 저장
 *   node marketing/export.js --platform threads  특정 플랫폼만
 *   node marketing/export.js --kind text         글만 (영상 제외) / video 는 영상만
 */
const fs = require('fs');
const queue = require('./lib/queue');
const { telegramLink } = require('./lib/link');

function render(post, platform) {
  const raw = (post.variants && post.variants[platform]) || post.text || '';
  return raw.includes('{{link}}')
    ? raw.split('{{link}}').join(telegramLink(platform, post.id))
    : raw;
}

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const platIdx = argv.indexOf('--platform');
const only = platIdx >= 0 ? argv[platIdx + 1] : null;
const kindIdx = argv.indexOf('--kind');
const kind = kindIdx >= 0 ? argv[kindIdx + 1] : null;

/** 영상 글인지 (videoUrl 또는 video 가 있으면 영상) */
const isVideo = (p) => !!(p.videoUrl || p.video);

const posts = queue
  .load()
  .posts.filter((p) => p.status === 'draft')
  .filter((p) => !only || (p.platforms || []).includes(only))
  .filter((p) => !kind || (kind === 'video' ? isVideo(p) : !isVideo(p)));

const out = [];
for (const post of posts) {
  const platforms = (post.platforms || []).filter((p) => !only || p === only);

  // 같은 문구를 쓰는 플랫폼은 한 번만 낸다
  const byText = new Map();
  for (const p of platforms) {
    const text = render(post, p);
    if (!byText.has(text)) byText.set(text, []);
    byText.get(text).push(p);
  }

  for (const [text, group] of byText) {
    out.push('─'.repeat(60));
    out.push(`${(post.publishAt || '').slice(0, 10)}  ${group.join(' / ')}`);
    if (post.title) out.push(`제목: ${post.title}`);
    out.push('─'.repeat(60));
    out.push('');
    out.push(text.trim());
    out.push('');
  }

  if (post.$script) {
    out.push('[촬영 대본]');
    for (const line of post.$script) out.push('  ' + line);
    out.push('');
  }
}

const text = out.join('\n');
if (outIdx >= 0) {
  fs.writeFileSync(argv[outIdx + 1], text);
  console.log(`${posts.length}건 저장: ${argv[outIdx + 1]}`);
} else {
  console.log(text);
}
