'use strict';
const fs = require('fs');
const path = require('path');

const BRAND_PATH = path.join(__dirname, '..', 'brand.json');

function load() {
  if (!fs.existsSync(BRAND_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(BRAND_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`brand.json 을 읽을 수 없습니다: ${e.message}`);
  }
}

/** 제휴 거래소 목록 [{name, url}] */
function exchanges() {
  const b = load();
  const list = (b.revenue && b.revenue.referral && b.revenue.referral.exchanges) || [];
  return list.filter((e) => e && e.url);
}

/**
 * {{ref}} → 첫 번째(대표) 거래소, {{ref:이름}} → 이름이 일치하는 거래소.
 * 등록된 링크가 없으면 명확히 실패시킨다. 조용히 빈 링크를 내보내지 않는다.
 */
function referralLink(name) {
  const list = exchanges();
  if (!list.length) {
    throw new Error(
      'brand.json 의 revenue.referral.exchanges 가 비어 있습니다. 거래소명과 레퍼럴 링크를 먼저 등록하세요.'
    );
  }
  if (!name) return list[0].url;

  const hit = list.find((e) => String(e.name).toLowerCase() === String(name).toLowerCase());
  if (!hit) throw new Error(`brand.json 에 "${name}" 거래소가 없습니다.`);
  return hit.url;
}

module.exports = { BRAND_PATH, load, exchanges, referralLink };
