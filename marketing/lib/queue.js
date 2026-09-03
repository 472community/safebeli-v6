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

/** 발행 대기 상태인가 (완전히 끝난 글은 제외) */
function isPending(post) {
  return post.status !== 'posted' && post.status !== 'canceled';
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
