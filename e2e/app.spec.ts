import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await nav(page, "今日");
});
async function nav(page: import("@playwright/test").Page, label: string) {
  await page
    .locator("nav:visible")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("任务持久化、独立完成、批量30天、日历状态与撤销", async ({ page }) => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("学习英语");
  await page.getByLabel("安排方式").selectOption("range");
  await page.getByLabel("开始 / 任务日期").fill("2026-10-19");
  await page.getByLabel("结束日期").fill("2026-11-17");
  await expect(page.getByText("将创建 30 个独立任务")).toBeVisible();
  await page.getByRole("button", { name: "保存任务" }).click();
  await page
    .getByLabel("选择任务日期", { exact: true })
    .filter({ visible: true })
    .last()
    .fill("2026-10-19");
  await page
    .getByRole("button", { name: "完成：学习英语", exact: true })
    .click();
  await page.reload();
  await nav(page, "今日");
  await page
    .getByLabel("选择任务日期", { exact: true })
    .filter({ visible: true })
    .last()
    .fill("2026-10-19");
  await expect(
    page.getByRole("button", { name: "撤销完成：学习英语", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "后一天" }).click();
  await expect(
    page.getByRole("button", { name: "完成：学习英语", exact: true }),
  ).toBeVisible();
  await nav(page, "日历");
  await expect(
    page.getByRole("button", { name: "2026-10-19，1/1 已完成" }),
  ).toHaveClass(/complete/);
  await page.getByRole("button", { name: "2026-10-19，1/1 已完成" }).click();
  await page
    .getByRole("button", { name: "撤销完成：学习英语", exact: true })
    .click();
  await nav(page, "日历");
  await expect(
    page.getByRole("button", { name: "2026-10-19，0/1 已完成" }),
  ).not.toHaveClass(/complete/);
  const count = await page.evaluate(
    () => JSON.parse(localStorage.getItem("daymark.data.v1")!).tasks.length,
  );
  expect(count).toBe(30);
});
test("快捷输入、生活记录、思想库持久化和编辑", async ({ page }) => {
  await page.getByLabel("快速添加任务").fill("读十页书");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByRole("button", { name: /今日记录/ }).click();
  await page.getByLabel("今日记录", { exact: true }).fill("今天迈出了第一步。");
  await nav(page, "思想库");
  await page.getByRole("button", { name: "记录想法", exact: true }).click();
  await expect(page.getByLabel("标题（可选）")).toHaveCount(0);
  await page.getByLabel("正文").fill("从小事开始。");
  await page.getByRole("button", { name: "保存想法" }).click();
  await page.reload();
  await nav(page, "思想库");
  await expect(page.getByText("从小事开始。")).toBeVisible();
  await page.getByRole("button", { name: "置顶", exact: true }).click();
  await page.getByLabel("搜索思想库").fill("从小事");
  await expect(page.getByText("从小事开始。", { exact: true })).toBeVisible();
  await nav(page, "今日");
  await expect(page.getByText("读十页书", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /今日记录/ }).click();
  await expect(page.getByLabel("今日记录", { exact: true })).toHaveValue(
    "今天迈出了第一步。",
  );
  await page.getByText("读十页书", { exact: true }).click();
  await page.getByLabel("任务名称").fill("读二十页书");
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByText("读二十页书", { exact: true })).toBeVisible();
});
test("移动布局、暗色主题、无任务不标绿", async ({ page }) => {
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  for (const label of ["今日", "日历", "思想库", "设置"]) {
    await nav(page, label);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "暗色", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await nav(page, "日历");
  await expect(page.locator(".day.complete")).toHaveCount(0);
});
test("星期重复、排序和删除单个实例", async ({ page }) => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("健身");
  await page.getByLabel("安排方式").selectOption("weekly");
  await page.getByLabel("开始 / 任务日期").fill("2026-10-19");
  await page.getByLabel("结束日期").fill("2026-10-25");
  for (const day of ["二", "四", "六", "日"])
    await page.getByRole("button", { name: day, exact: true }).click();
  await page.getByRole("button", { name: "保存任务" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("daymark.data.v1")!).tasks.map(
        (t: { date: string }) => t.date,
      ),
    ),
  ).toEqual(["2026-10-19", "2026-10-21", "2026-10-23"]);
  await page
    .getByLabel("选择任务日期", { exact: true })
    .last()
    .fill("2026-10-19");
  await page.getByLabel("快速添加任务").fill("第二件事");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("操作：第二件事", { exact: true }).click();
  await page.getByRole("button", { name: "上移", exact: true }).click();
  await expect(page.locator(".task-title").first()).toHaveText("第二件事");
  await page.getByLabel("操作：健身", { exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除", exact: true }).last().click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("daymark.data.v1")!).tasks.filter(
          (t: { title: string }) => t.title === "健身",
        ).length,
    ),
  ).toBe(2);
});
test("损坏备份不改动数据，有效备份可恢复", async ({ page }) => {
  await page.getByLabel("快速添加任务").fill("保留我");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await nav(page, "设置");
  const original = await page.evaluate(() =>
    localStorage.getItem("daymark.data.v1"),
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("status")).toContainText("导入失败");
  expect(
    await page.evaluate(() => localStorage.getItem("daymark.data.v1")),
  ).toBe(original);
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"tasks":[],"journals":{},"thoughts":[]}'),
  });
  await expect(page.getByRole("status")).toContainText("备份已验证并导入");
  await nav(page, "今日");
  await expect(page.getByText("保留我", { exact: true })).toHaveCount(0);
});
