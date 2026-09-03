#!/usr/bin/env node
'use strict';
/** 자격증명 점검기: 어떤 플랫폼이 지금 당장 자동발행 가능한지 확인한다. */
const { isReady, telegramLink } = require('./lib/config');
const { C } = require('./lib/util');

const ADAPTERS = {
  telegram: require('./lib/telegram'),
  threads: require('./lib/threads'),
  instagram: require('./lib/instagram'),
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
  console.log(`\n유입 추적 링크 예시: ${telegramLink('ig_test')}`);
  console.log(C.gray(`발행 가능한 플랫폼 ${ready}개`));
})();
