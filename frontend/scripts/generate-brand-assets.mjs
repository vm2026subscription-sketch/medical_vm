import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public/brand");
const company = (await fs.readFile(path.join(brandDir, "vidyarthi-mitra.png"))).toString("base64");
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="310" height="120" viewBox="0 0 310 120"><title>MedPath by Vidyarthi Mitra</title><text x="0" y="53" font-family="Arial,sans-serif" font-size="57" font-weight="700" fill="#25355b">MedPath</text><text x="2" y="99" font-family="Arial,sans-serif" font-size="20" fill="#58627b">by</text><image x="33" y="64" width="222" height="56" href="data:image/png;base64,${company}"/></svg>`;
await fs.writeFile(path.join(brandDir, "medpath-logo.svg"), wordmark);
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f4f6fb"/><rect width="20" height="630" fill="#f58232"/><circle cx="1090" cy="85" r="240" fill="#e5ebf6"/><text x="76" y="118" font-family="Arial,sans-serif" font-size="57" font-weight="700" fill="#25355b">MedPath</text><text x="78" y="164" font-family="Arial,sans-serif" font-size="20" fill="#58627b">by</text><image x="109" y="129" width="222" height="56" href="data:image/png;base64,${company}"/><text x="78" y="276" font-family="Arial,sans-serif" font-size="49" font-weight="700" fill="#25355b">Your medical admission journey.</text><text x="78" y="342" font-family="Arial,sans-serif" font-size="49" font-weight="700" fill="#25355b">Guidance at every step.</text><text x="80" y="399" font-family="Arial,sans-serif" font-size="24" fill="#58627b">College discovery · NEET cutoffs · Expert counselling</text><rect x="76" y="454" width="1050" height="2" fill="#dce3f2"/><text x="80" y="538" font-family="Arial,sans-serif" font-size="25" fill="#25355b">medical.vidyarthimitra.org</text></svg>`;
await fs.writeFile(path.join(brandDir, "social-preview.svg"), social);
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : "chromium",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<html><body style="margin:0">${social}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(brandDir, "social-preview.png") });
} finally {
  await browser.close();
}
console.log("Generated MedPath logo and share image. Existing favicon was not modified.");
