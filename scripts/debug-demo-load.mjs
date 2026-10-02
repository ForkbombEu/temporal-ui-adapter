#!/usr/bin/env node
/**
 * Feedback loop for /demo hang.
 * RED = interactive marker missing within TIMEOUT_MS (or pageerror / browser crash).
 * GREEN = [data-forkbomb="workflow-history"] visible.
 *
 * Usage: node scripts/debug-demo-load.mjs [url] [timeoutMs]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5199/demo';
const timeoutMs = Number(process.argv[3] ?? 15000);
const marker = '[data-forkbomb="workflow-history"]';

const consoleLines = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  consoleLines.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err?.stack ?? err));
});

const t0 = performance.now();
let navMs = null;
let markerMs = null;
let verdict = 'RED';
let detail = '';

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  navMs = Math.round(performance.now() - t0);

  try {
    await page.waitForSelector(marker, { timeout: Math.max(1000, timeoutMs - navMs) });
    markerMs = Math.round(performance.now() - t0);
    verdict = 'GREEN';
    detail = `marker visible`;
  } catch {
    verdict = 'RED';
    detail = `marker ${marker} not visible within ${timeoutMs}ms`;
  }
} catch (err) {
  verdict = 'RED';
  detail = `navigation failed: ${err.message}`;
  navMs = Math.round(performance.now() - t0);
}

const htmlSnippet = await page
  .locator('body')
  .innerText()
  .catch(() => '<body unreadable>');

await browser.close();

const report = {
  verdict,
  detail,
  url,
  timeoutMs,
  navMs,
  markerMs,
  pageErrorCount: pageErrors.length,
  pageErrors: pageErrors.slice(0, 5),
  consoleTail: consoleLines.slice(-30),
  bodyPreview: String(htmlSnippet).slice(0, 400),
};

console.log(JSON.stringify(report, null, 2));
process.exit(verdict === 'GREEN' ? 0 : 1);
