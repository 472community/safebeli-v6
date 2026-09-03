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
const { isReady, telegramLink } = require('./lib/config');
const { C } = require('./lib/util');

const ADAPTERS = {
  telegram: require('./lib/telegram'),
  threads: require('./lib/threads'),
  instagram: require('./lib/instagram'),
  youtube: require('./lib/youtube')
};

const SOURCE_CODE = { telegram: 'tg', threads: 'th', instagram: 'ig', youtube: 'yt' };

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

/** 본문의 {{link}} 를 플랫폼별 유입추적 텔레그램 링크로 치환 */
function render(post, platform) {
  const raw = (post.variants && post.variants[platform]) || post.text || '';
  const source = `${SOURCE_CODE[platform] || platform}_${String(post.id).replace(/[^A-Za-z0-9_]/g, '_')}`;
  return raw.split('{{link}}').join(telegramLink(source)).trim();
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
      const text = render(post, platform);

      // 드라이런은 자격증명이 없어도 초안을 그대로 보여준다 (검수용).
      if (!args.live) {
        const mark = isReady(platform) ? C.green('●') : C.yellow('○ 자격증명 미설정');
        console.log(`  ${C.bold(platform)} ${mark}`);
        console.log(text.split('\n').map((l) => '    │ ' + l).join('\n'));
        if (post.media && post.media.length) console.log(C.gray(`    이미지: ${post.media.join(', ')}`));
        if (post.video) console.log(C.gray(`    영상: ${post.video}`));
        continue;
      }

      if (!isReady(platform)) {
        console.log(C.yellow(`  ${platform}: 자격증명 없음 → 건너뜀`));
        continue;
      }

      try {
        const r = await adapter.publish({
          text,
          media: post.media || [],
          video: post.video,
          title: post.title,
          tags: post.tags || []
        });
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
