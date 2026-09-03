#!/usr/bin/env node
'use strict';
/**
 * SNS 발행기.
 *
 *   node marketing/publish.js                # 드라이런 — 발행 예정 내용만 출력 (기본값, 안전)
 *   node marketing/publish.js --live         # 실제 발행 (발행 시각이 도래한 글만)
 *   node marketing/publish.js --id my-post --live --now   # 특정 글을 시각 무시하고 즉시 발행
 *   node marketing/publish.js --platform telegram --live  # 특정 플랫폼만
 */
const queue = require('./lib/queue');
const { isReady } = require('./lib/config');
const { telegramLink } = require('./lib/link');
const brand = require('./lib/brand');
const media = require('./lib/media');
const { C } = require('./lib/util');

const ADAPTERS = {
  telegram: require('./lib/telegram'),
  threads: require('./lib/threads'),
  instagram: require('./lib/instagram'),
  tiktok: require('./lib/tiktok'),
  youtube: require('./lib/youtube')
};

/**
 * 거래소 레퍼럴 링크를 본문에 넣어도 되는 곳.
 * 스레드·인스타·틱톡은 제휴 링크를 스팸으로 판정해 도달을 죽이거나 계정을 제재한다.
 * 유튜브 설명란은 허용되지만 유료 프로모션 표시가 필요하다.
 */
const REFERRAL_ALLOWED = new Set(['telegram', 'youtube']);

function parseArgs(argv) {
  const a = { live: false, now: false, id: null, platform: null };
  for (let i = 2; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--live') a.live = true;
    else if (v === '--now') a.now = true;
    else if (v === '--id') a.id = argv[++i];
    else if (v === '--platform') a.platform = argv[++i];
  }
  return a;
}

/**
 * 본문 치환.
 *   {{link}}        → 플랫폼·글별 유입추적 텔레그램 링크
 *   {{ref}}         → 대표 거래소 레퍼럴 링크
 *   {{ref:이름}}    → 지정 거래소 레퍼럴 링크
 */
function render(post, platform) {
  const raw = (post.variants && post.variants[platform]) || post.text || '';

  let out = raw.includes('{{link}}')
    ? raw.split('{{link}}').join(telegramLink(platform, post.id))
    : raw;

  if (/\{\{ref(:[^}]+)?\}\}/.test(out)) {
    if (!REFERRAL_ALLOWED.has(platform)) {
      throw new Error(
        `${platform} 본문에는 레퍼럴 링크를 넣을 수 없습니다 (스팸 판정·계정 제재 위험). ` +
          '{{ref}} 를 빼고 CTA 는 {{link}}(텔레그램) 하나로 두세요.'
      );
    }
    out = out.replace(/\{\{ref(?::([^}]+))?\}\}/g, (_, name) => brand.referralLink(name));
  }

  return out.trim();
}

async function main() {
  const args = parseArgs(process.argv);
  const data = queue.load();
  const now = new Date();

  let targets = data.posts.filter((p) =>
    args.id ? p.id === args.id : queue.isDue(p, now)
  );
  if (args.id && args.now) targets = data.posts.filter((p) => p.id === args.id);
  if (args.id && !targets.length) {
    console.error(C.red(`큐에 id="${args.id}" 인 글이 없습니다.`));
    process.exit(1);
  }

  if (!targets.length) {
    console.log(C.gray('발행할 글이 없습니다 (발행 시각 도래한 글 0건).'));
    return;
  }

  console.log(
    C.bold(`${args.live ? '실제 발행' : '드라이런(발행 안 함)'} — 대상 ${targets.length}건`)
  );

  let changed = false;
  let failures = 0;

  for (const post of targets) {
    let platforms = queue.remainingPlatforms(post);
    if (args.platform) platforms = platforms.filter((p) => p === args.platform);

    console.log(`\n${C.bold('▶ ' + post.id)} ${C.gray(post.publishAt || '(즉시)')}`);
    if (!platforms.length) {
      console.log(C.gray('  발행할 플랫폼 없음 (이미 완료됨)'));
      continue;
    }

    post.results = post.results || {};

    for (const platform of platforms) {
      const adapter = ADAPTERS[platform];
      if (!adapter) {
        console.log(C.red(`  ${platform}: 지원하지 않는 플랫폼`));
        continue;
      }
      let text;
      try {
        text = render(post, platform);
      } catch (e) {
        // 치환 규칙 위반은 발행 전에 잡는다. 한 건이 나머지 발행을 막지 않게 한다.
        failures++;
        console.log(C.red(`  ${platform}: ${e.message}`));
        continue;
      }

      // 드라이런은 자격증명이 없어도 초안을 그대로 보여준다 (검수용).
      if (!args.live) {
        const mark = isReady(platform) ? C.green('●') : C.yellow('○ 자격증명 미설정');
        console.log(`  ${C.bold(platform)} ${mark}`);
        console.log(text.split('\n').map((l) => '    │ ' + l).join('\n'));
        const imgs = media.imageUrls(post);
        if (imgs.length) console.log(C.gray(`    이미지: ${imgs.join(', ')}`));
        const vid = media.videoUrl(post) || post.video;
        if (vid) console.log(C.gray(`    영상: ${vid}`));
        continue;
      }

      if (!isReady(platform)) {
        console.log(C.yellow(`  ${platform}: 자격증명 없음 → 건너뜀`));
        continue;
      }

      try {
        const r = await adapter.publish({ ...post, text });
        post.results[platform] = { ok: true, id: r.id, url: r.url || null, at: new Date().toISOString() };
        changed = true;
        console.log(C.green(`  ${platform}: 발행 완료 ${r.url || r.id}`));
      } catch (e) {
        post.results[platform] = { ok: false, error: String(e.message), at: new Date().toISOString() };
        changed = true;
        failures++;
        console.log(C.red(`  ${platform}: 실패 — ${e.message}`));
      }
    }

    if (args.live) {
      const wanted = post.platforms || [];
      const done = wanted.filter((p) => post.results[p] && post.results[p].ok);
      const blocked = wanted.filter((p) => !isReady(p));
      post.status =
        done.length && done.length + blocked.length >= wanted.length ? 'posted' : 'partial';
    }
  }

  if (args.live && changed) {
    queue.save(data);
    console.log(C.gray('\n큐 상태를 저장했습니다.'));
  }

  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(C.red(e.stack || e.message));
  process.exit(1);
});
