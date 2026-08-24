import { test, expect } from "@playwright/test";

test("admin can sign in with configured credentials", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD are not set");

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "دخول" })).toBeEnabled();
  await page.getByLabel("البريد الإلكتروني").fill(email!);
  await page.getByLabel("كلمة المرور").fill(password!);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByRole("heading", { name: "الرئيسية" })).toBeVisible({ timeout: 15_000 });
});
