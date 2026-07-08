import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chromium, type Page } from "playwright";

export interface CaptureStep {
  name: string;
  waitForMs?: number;
  click?: string;
  fill?: { selector: string; value: string };
  screenshotName?: string;
}

export interface CaptureUrlOptions {
  url: string;
  outputDir: string;
  viewport?: { width: number; height: number };
  steps?: CaptureStep[];
  lightThemeHint?: boolean;
}

export interface CaptureResult {
  screenshots: string[];
  pageSummary?: unknown;
}

export async function captureUrl(options: CaptureUrlOptions): Promise<CaptureResult> {
  mkdirSync(options.outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    colorScheme: options.lightThemeHint === false ? "dark" : "light"
  });

  try {
    await page.goto(options.url, { waitUntil: "networkidle" });
    if (options.lightThemeHint !== false) {
      await page.emulateMedia({ colorScheme: "light" });
    }

    const screenshots: string[] = [];
    await screenshot(page, options.outputDir, screenshots, "initial.png");

    for (const step of options.steps ?? []) {
      if (step.fill) await page.fill(step.fill.selector, step.fill.value);
      if (step.click) await page.click(step.click);
      if (step.waitForMs) await page.waitForTimeout(step.waitForMs);
      await screenshot(page, options.outputDir, screenshots, step.screenshotName ?? `${safeName(step.name)}.png`);
    }

    const pageSummary = await page.evaluate(() => ({
      title: document.title,
      headings: [...document.querySelectorAll("h1,h2,h3")].slice(0, 12).map((node) => node.textContent?.trim()).filter(Boolean),
      buttons: [...document.querySelectorAll("button,a")].slice(0, 20).map((node) => node.textContent?.trim()).filter(Boolean)
    }));
    return { screenshots, pageSummary };
  } finally {
    await browser.close();
  }
}

async function screenshot(page: Page, outputDir: string, screenshots: string[], name: string): Promise<void> {
  const path = resolve(outputDir, basename(name));
  await page.screenshot({ path, fullPage: false });
  screenshots.push(path);
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "capture";
}
