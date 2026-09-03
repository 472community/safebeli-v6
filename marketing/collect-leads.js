#!/usr/bin/env node
'use strict';
/**
 * 텔레그램 유입 수집기 — 서버/호스팅이 필요 없다.
 *
 * SNS 글의 링크는 https://t.me/<bot>?start=<source> 형태다.
 * 사용자가 그 링크로 들어와 봇을 시작하면 텔레그램에 "/start <source>" 가 남는다.
 * 이 스크립트가 getUpdates 로 그걸 주기적으로 걷어와
 * marketing/content/leads.json 에 "누가 어느 글을 보고 들어왔는지" 를 기록한다.
 *
 *   node marketing/collect-leads.js            # 수집 + 리포트
 *   node marketing/collect-leads.js --report   # 수집 없이 리포트만
 *
 * 주의: 같은 봇에 웹훅이 등록돼 있으면 getUpdates 가 막힌다.
 *       해제: curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
 */
const fs = require('fs');
const path = require('path');
const { config } = require('./lib/config');
const { api, form, C } = require('./lib/util');

const LEADS_PATH = path.join(__dirname, 'content', 'leads.json');
const base = () => `https://api.telegram.org/bot${config.telegram.botToken}`;

function load() {
  if (!fs.existsSync(LEADS_PATH)) return { offset: 0, leads: [] };
  const d = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
  if (!Array.isArray(d.leads)) d.leads = [];
  if (typeof d.offset !== 'number') d.offset = 0;
  return d;
}

function save(d) {
  fs.writeFileSync(LEADS_PATH, JSON.stringify(d, null, 2) + '\n');
}

async function collect(state) {
  let added = 0;
  const known = new Set(state.leads.map((l) => l.telegram_id));

  // getUpdates 는 한 번에 최대 100건. 더 있으면 계속 당긴다.
  for (let round = 0; round < 20; round++) {
    let batch;
    try {
      batch = await api(`${base()}/getUpdates?offset=${state.offset}&limit=100&timeout=0`);
    } catch (e) {
      if (String(e.message).includes('409')) {
        throw new Error(
          '이 봇에 웹훅이 걸려 있어 수집할 수 없습니다. ' +
            `해제: curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`
        );
      }
      throw e;
    }

    const updates = batch.result || [];
    if (!updates.length) break;

    for (const u of updates) {
      state.offset = u.update_id + 1;
      const msg = u.message;
      if (!msg || !msg.text || !msg.text.startsWith('/start')) continue;

      const source = (msg.text.trim().split(/\s+/)[1] || 'direct').slice(0, 64);
      const id = String(msg.from.id);
      if (known.has(id)) continue; // 재유입은 최초 출처를 유지한다

      known.add(id);
      state.leads.push({
        telegram_id: id,
        username: msg.from.username || null,
        first_name: msg.from.first_name || null,
        source,
        at: new Date(msg.date * 1000).toISOString()
      });
      added++;

      if (config.welcomeMessage) {
        try {
          await api(`${base()}/sendMessage`, {
            method: 'POST',
            body: form({ chat_id: msg.chat.id, text: config.welcomeMessage, parse_mode: 'HTML' })
          });
        } catch (e) {
          console.log(C.yellow(`  환영 메시지 실패 (${id}): ${e.message}`));
        }
      }
    }

    if (updates.length < 100) break;
  }
  return added;
}

function report(state) {
  if (!state.leads.length) {
    console.log(C.gray('아직 수집된 유입이 없습니다.'));
    return;
  }
  const bySource = new Map();
  for (const l of state.leads) bySource.set(l.source, (bySource.get(l.source) || 0) + 1);
  const rows = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  console.log(C.bold(`\n유입 출처별 집계 (총 ${state.leads.length}명)\n`));
  const width = Math.max(...rows.map((r) => r[0].length), 6);
  for (const [source, n] of rows) {
    const bar = '█'.repeat(Math.min(40, Math.round((n / rows[0][1]) * 40)));
    console.log(`  ${source.padEnd(width)}  ${String(n).padStart(4)}  ${C.green(bar)}`);
  }

  const last7 = state.leads.filter(
    (l) => Date.now() - new Date(l.at).getTime() < 7 * 864e5
  ).length;
  console.log(C.gray(`\n  최근 7일 신규 유입: ${last7}명`));
}

(async () => {
  const state = load();
  const reportOnly = process.argv.includes('--report');

  if (!reportOnly) {
    if (!config.telegram.botToken) {
      console.error(C.red('TELEGRAM_BOT_TOKEN 이 없습니다.'));
      process.exit(1);
    }
    const added = await collect(state);
    save(state);
    console.log(added ? C.green(`신규 유입 ${added}명 기록`) : C.gray('신규 유입 없음'));
  }

  report(state);
})().catch((e) => {
  console.error(C.red(e.message));
  process.exit(1);
});
