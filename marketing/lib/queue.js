'use strict';
const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '..', 'content', 'queue.json');

function load() {
  if (!fs.existsSync(QUEUE_PATH)) return { posts: [] };
  const data = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  if (!Array.isArray(data.posts)) data.posts = [];
  return data;
}

function save(data) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

/**
 * 자동 발행 대상 상태인가.
 * 'draft' 는 승인 전 초안이라 자동으로 나가지 않는다. 승인 시 'scheduled' 로 바꾼다.
 * ('partial' 은 일부 플랫폼만 성공한 글 — 실패분을 다음 실행에서 재시도한다)
 */
const PUBLISHABLE = new Set(['scheduled', 'partial']);

function isPending(post) {
  return PUBLISHABLE.has(post.status);
}

/** 지금 시각 기준으로 발행 시각이 도래했는가 */
function isDue(post, now = new Date()) {
  if (!isPending(post)) return false;
  if (!post.publishAt) return true; // 시각 미지정 = 즉시
  return new Date(post.publishAt).getTime() <= now.getTime();
}

/** 이 글에서 아직 성공하지 못한 플랫폼 목록 */
function remainingPlatforms(post) {
  const results = post.results || {};
  return (post.platforms || []).filter((p) => !(results[p] && results[p].ok));
}

module.exports = { QUEUE_PATH, load, save, isPending, isDue, remainingPlatforms };
