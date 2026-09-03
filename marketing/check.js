#!/usr/bin/env node
'use strict';
/** 자격증명 점검기: 어떤 플랫폼이 지금 당장 자동발행 가능한지 확인한다. */
const { isReady, config } = require('./lib/config');
const link = require('./lib/link');
const { C } = require('./lib/util');

const ADAPTERS = {
  telegram: require('./lib/telegram'),
  threads: require('./lib/threads'),
  instagram: require('./lib/instagram'),
  tiktok: require('./lib/tiktok'),
  youtube: require('./lib/youtube')
};

(async () => {
  console.log(C.bold('SNS 자동발행 준비 상태\n'));
  let ready = 0;
  for (const [name, adapter] of Object.entries(ADAPTERS)) {
    if (!isReady(name)) {
      console.log(`${C.yellow('○')} ${name.padEnd(10)} 자격증명 미설정`);
      continue;
    }
    try {
      const info = await adapter.check();
      console.log(`${C.green('●')} ${name.padEnd(10)} 연결됨 — ${info}`);
      ready++;
    } catch (e) {
      console.log(`${C.red('✕')} ${name.padEnd(10)} 자격증명 오류 — ${e.message}`);
    }
  }
  console.log(C.bold(`\n텔레그램 유입 링크 (모드: ${config.telegram.linkMode})\n`));
  for (const row of link.describe()) {
    const mark = row.tracked ? C.green('추적됨') : C.yellow('추적 안 됨');
    console.log(`  ${row.platform.padEnd(10)} ${mark}  ${row.link}`);
  }
  console.log(C.gray(`\n발행 가능한 플랫폼 ${ready}개`));
})();
