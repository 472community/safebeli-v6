#!/usr/bin/env node
'use strict';
/**
 * 원클릭 발행.
 *
 *   node marketing/go.js              승인 대기 초안 전부 — 미리보기 → 확인 → 모든 SNS 동시 발행
 *   node marketing/go.js <글id>       그 글만
 *   node marketing/go.js --yes        확인 없이 바로 발행
 *
 * 발행은 글에 적힌 모든 플랫폼으로 한 번에 나간다.
 * 자격증명이 없는 플랫폼은 조용히 건너뛰고, 나머지는 그대로 올라간다.
 */
const readline = require('readline');
const { spawnSync } = require('child_process');
const path = require('path');
const queue = require('./lib/queue');
const { readyPlatforms } = require('./lib/config');
const { C } = require('./lib/util');

const PUBLISH = path.join(__dirname, 'publish.js');

function run(args) {
  return spawnSync(process.execPath, [PUBLISH, ...args], { stdio: 'inherit' });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a))));
}

(async () => {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');
  const wantedId = args.find((a) => !a.startsWith('-'));

  const data = queue.load();
  const drafts = data.posts.filter((p) =>
    wantedId ? p.id === wantedId : p.status === 'draft'
  );

  if (!drafts.length) {
    console.log(
      wantedId
        ? C.red(`큐에 id="${wantedId}" 인 글이 없습니다.`)
        : C.gray('발행 대기 중인 초안이 없습니다.')
    );
    process.exit(wantedId ? 1 : 0);
  }

  const ready = readyPlatforms();
  if (!ready.length) {
    console.log(C.red('연결된 SNS 계정이 하나도 없습니다. 먼저 node marketing/check.js 를 확인하세요.'));
    process.exit(1);
  }

  console.log(C.bold(`\n발행 대기 ${drafts.length}건 · 연결된 계정: ${ready.join(', ')}\n`));
  for (const p of drafts) {
    const skipped = (p.platforms || []).filter((x) => !ready.includes(x));
    console.log(
      `  ${C.bold(p.id)} → ${p.platforms.join(', ')}` +
        (skipped.length ? C.yellow(`  (미연결 건너뜀: ${skipped.join(', ')})`) : '')
    );
  }

  console.log(C.gray('\n─ 미리보기 ─'));
  for (const p of drafts) run(['--id', p.id, '--now']);

  if (!yes) {
    const a = await ask(C.bold(`\n위 ${drafts.length}건을 지금 모든 SNS 에 올립니다. 진행할까요? [y/N] `));
    if (!/^y(es)?$/i.test(a.trim())) {
      console.log(C.gray('취소했습니다. 아무것도 발행되지 않았습니다.'));
      process.exit(0);
    }
  }

  let failed = 0;
  for (const p of drafts) {
    console.log(C.bold(`\n━━ ${p.id} 발행 중 ━━`));
    const r = run(['--id', p.id, '--now', '--live']);
    if (r.status !== 0) failed++;
  }

  console.log(
    failed
      ? C.yellow(`\n${drafts.length - failed}건 완료, ${failed}건 실패. 실패분은 다시 실행하면 재시도합니다.`)
      : C.green(`\n${drafts.length}건 전부 발행 완료.`)
  );
  process.exit(failed ? 1 : 0);
})();
