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

test("production restore wizard advances to step 3 and validates the hyphenated phrase", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD are not set");

  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email!);
  await page.getByLabel("كلمة المرور").fill(password!);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByRole("heading", { name: "الرئيسية" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/backups");
  await expect(page.getByRole("heading", { name: "النسخ الاحتياطية" })).toBeVisible();

  const openButton = page.getByRole("button", { name: "استعادة الإنتاج" }).first();
  test.skip((await openButton.count()) === 0, "no backups available");

  const enabledOpen = page.locator("button:not([disabled])", { hasText: "استعادة الإنتاج" }).first();
  if ((await enabledOpen.count()) === 0) {
    await expect(openButton).toHaveAttribute("title", /اختبار استعادة ناجح/);
    test.skip(true, "no backup with a successful restore test");
  }

  await enabledOpen.click();
  await expect(page.getByRole("heading", { name: /الخطوة 1 من 5/ })).toBeVisible();
  const backupNumberText = await page.getByText(/رقم النسخة:/).textContent();
  const backupNumber = backupNumberText?.match(/\d+/)?.[0];
  expect(backupNumber).toBeTruthy();

  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 2 من 5/ })).toBeVisible();
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 3 من 5/ })).toBeVisible();

  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 4 من 5/ })).toBeVisible();

  const acknowledge = page.getByRole("checkbox");
  await acknowledge.click();
  await expect(acknowledge).toBeChecked();

  await page.getByLabel("اكتب استعادة-الإنتاج").fill("استعادة الإنتاج");
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByText(/بشرطة وليس مسافة/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /الخطوة 4 من 5/ })).toBeVisible();

  await page.getByLabel("اكتب استعادة-الإنتاج").fill("استعادة-الإنتاج");
  await page.getByLabel("رقم النسخة").fill(backupNumber!);
  await page.getByLabel("كلمة المرور الحالية").fill("wrong-password-for-wizard");
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 5 من 5/ })).toBeVisible();

  await page.getByRole("button", { name: "السابق" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 4 من 5/ })).toBeVisible();
  await expect(page.getByLabel("اكتب استعادة-الإنتاج")).toHaveValue("استعادة-الإنتاج");
  await expect(page.getByLabel("رقم النسخة")).toHaveValue(backupNumber!);
  await expect(acknowledge).toBeChecked();

  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByRole("heading", { name: /الخطوة 5 من 5/ })).toBeVisible();
  await page.getByRole("button", { name: "بدء إنشاء قاعدة الاستعادة المرشحة" }).click();
  await expect(page.getByText(/كلمة المرور الحالية غير صحيحة|رُفض الطلب|نافذة الصيانة|اختبار استعادة ناجح|تعذر بدء استعادة الإنتاج/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/backups/);
});
