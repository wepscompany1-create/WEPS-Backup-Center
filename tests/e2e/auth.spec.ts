import { test, expect } from "@playwright/test";

test("login page is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("تسجيل الدخول", { exact: true })).toBeVisible();
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
});

test("dashboard pages including production restores require login", async ({ page }) => {
  await page.goto("/login");
  const expectedOrigin = new URL(page.url()).origin;
  for (const path of ["/backups", "/settings", "/audit", "/restore-tests", "/production-restores"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/login/);
    expect(new URL(page.url()).origin).toBe(expectedOrigin);
  }
});

test("production restore APIs require login", async ({ request }) => {
  const responses = await Promise.all([
    request.get("/api/production-restores"),
    request.post("/api/production-restores", { data: {} }),
    request.get("/api/production-restores/missing"),
    request.post("/api/production-restores/missing/cutover", { data: {} }),
    request.post("/api/production-restores/missing/drop-previous", { data: {} }),
  ]);
  for (const response of responses) {
    expect(response.status()).toBe(401);
    expect(response.headers().location).toBeUndefined();
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  }
});

test("unauthenticated backup API returns JSON without a login redirect", async ({ request }) => {
  const response = await request.post("/api/backups");
  expect(response.status()).toBe(401);
  expect(response.headers().location).toBeUndefined();
  await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
});

test("invalid login stays on the form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("nobody@example.com");
  await page.getByLabel("كلمة المرور").fill("wrong-password-value");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText("غير صحيحة")).toBeVisible();
});
