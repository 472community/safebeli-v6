'use strict';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    body = { raw };
  }
  if (!res.ok) {
    const msg =
      (body.error && (body.error.message || body.error)) ||
      body.description ||
      body.raw ||
      res.statusText;
    const err = new Error(`${res.status} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function form(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    p.append(k, String(v));
  }
  return p;
}

const C = {
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`
};

function log(...a) {
  console.log(...a);
}

module.exports = { sleep, api, form, C, log };
