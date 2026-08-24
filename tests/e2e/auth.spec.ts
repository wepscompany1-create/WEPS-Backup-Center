import { test, expect } from "@playwright/test";

test("login page is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
});

test("backups, settings, audit, and restore-tests require login", async ({ page }) => {
  for (const path of ["/backups", "/settings", "/audit", "/restore-tests"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/login/);
  }
});

test("invalid login stays on the form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("nobody@example.com");
  await page.getByLabel("كلمة المرور").fill("wrong-password-value");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText("غير صحيحة")).toBeVisible();
});
