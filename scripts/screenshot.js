const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3100";
const OUT = "/tmp/shots";
require("fs").mkdirSync(OUT, { recursive: true });

async function login(page, identifier, password) {
  await page.goto(`${BASE}/sign-in`);
  await page.fill("#identifier", identifier);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

  async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log("saved", name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium/chrome-linux/chrome" }).catch(() => chromium.launch());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Landing
  await page.goto(`${BASE}/`);
  await shot(page, "01-landing.png");

  // Sign in as employee
  await login(page, "EMP1001", "Demo@1234");
  await shot(page, "02-employee-dashboard.png");

  await page.goto(`${BASE}/attendance`);
  await shot(page, "03-employee-attendance.png");

  await page.goto(`${BASE}/leave`);
  await shot(page, "04-employee-leave.png");

  await page.goto(`${BASE}/payroll`);
  await shot(page, "05-employee-payroll.png");

  await page.goto(`${BASE}/profile`);
  await shot(page, "06-employee-profile.png");

  await page.goto(`${BASE}/ai`);
  await shot(page, "07-employee-ai.png");

  // sign out
  await page.goto(`${BASE}/dashboard`);
  await page.click('button:has-text("Sign out")').catch(() => {});
  await page.waitForTimeout(500);

  // Sign in as HR
  await login(page, "HR001", "Demo@1234");
  await shot(page, "08-hr-command-center.png");

  await page.goto(`${BASE}/hr/employees`);
  await shot(page, "09-hr-employees.png");

  await page.goto(`${BASE}/hr/leave`);
  await shot(page, "10-hr-leave.png");

  await page.goto(`${BASE}/hr/attendance`);
  await shot(page, "11-hr-attendance.png");

  await page.goto(`${BASE}/hr/anomalies`);
  await shot(page, "12-hr-anomalies.png");

  await page.goto(`${BASE}/hr/analytics`);
  await page.waitForTimeout(1200);
  await shot(page, "13-hr-analytics.png");

  // Mobile viewport check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/hr`);
  await shot(page, "14-hr-mobile.png");
  await page.goto(`${BASE}/hr/attendance`);
  await shot(page, "15-hr-attendance-mobile.png");

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
