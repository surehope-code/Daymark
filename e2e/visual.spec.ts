import { test, expect } from "@playwright/test";
test("页面视觉检查、编辑器与窄屏无溢出", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "日历", exact: true }),
  ).toBeVisible();
  await expect(page.locator("nav:visible button").first()).toHaveText("日历");
  await page.screenshot({
    path: `artifacts/${info.project.name}-calendar.png`,
    fullPage: true,
  });
  await page
    .locator("nav:visible")
    .getByRole("button", { name: "今日", exact: true })
    .click();
  for (const title of [
    "阅读二十分钟，留一点时间给自己",
    "整理这周的计划",
    "傍晚出去走走",
  ]) {
    await page.getByLabel("快速添加任务").fill(title);
    await page.getByRole("button", { name: "添加任务", exact: true }).click();
  }
  await page
    .getByRole("button", {
      name: "完成：阅读二十分钟，留一点时间给自己",
      exact: true,
    })
    .click();
  await page.screenshot({
    path: `artifacts/${info.project.name}-today.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await page.getByLabel("安排方式").selectOption("weekly");
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 700 });
  for (const mode of ["single", "range", "multiple", "weekly"]) {
    await page.getByLabel("安排方式").selectOption(mode);
    expect(
      await page
        .locator("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page
        .locator("dialog")
        .evaluate(
          (el) =>
            el.getBoundingClientRect().left >= 0 &&
            el.getBoundingClientRect().right <= innerWidth,
        ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `artifacts/${info.project.name}-editor.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "取消", exact: true }).click();
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const label of ["今日", "日历", "思想库", "设置"]) {
      await page
        .locator("nav:visible")
        .getByRole("button", { name: label, exact: true })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
