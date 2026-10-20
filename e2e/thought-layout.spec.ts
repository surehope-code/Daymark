import { test, expect } from "@playwright/test";

test("思想卡片紧凑、长正文完整、菜单操作可用", async ({ page }, info) => {
  await page.goto("/");
  const longBody = Array.from(
    { length: 20 },
    (_, i) => `第 ${i + 1} 段：记录观察与思考，保留完整内容。`,
  ).join("\n");
  await page.evaluate((body) => {
    const now = new Date().toISOString();
    const thoughts = [
      { id: "short", body: "先行动，再调整。", category: "人生原则" },
      { id: "second", body: "记录值得记住的事。", category: "生活感悟" },
      { id: "long", body, category: "自我反思" },
    ].map((t) => ({
      ...t,
      title: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    }));
    localStorage.setItem(
      "daymark.data.v1",
      JSON.stringify({ version: 1, tasks: [], journals: {}, thoughts }),
    );
  }, longBody);
  await page.reload();
  await page
    .locator("nav:visible")
    .getByRole("button", { name: "思想库", exact: true })
    .click();
  const short = page
    .locator(".thought-card")
    .filter({ hasText: "先行动，再调整。" });
  const long = page.locator(".thought-card").filter({ hasText: "第 20 段" });
  expect((await short.boundingBox())!.height).toBeLessThan(80);
  await expect(long.locator(".thought-body")).toHaveText(longBody);
  expect(
    await long
      .locator(".thought-body")
      .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  expect((await long.boundingBox())!.height).toBeGreaterThan(330);
  await expect(
    page.locator(".thought-card footer, .thought-card .tag"),
  ).toHaveCount(0);
  const colors = await page
    .locator(".category-line")
    .evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor),
    );
  expect(new Set(colors).size).toBe(3);
  await page.screenshot({
    path: `artifacts/${info.project.name}-thoughts.png`,
    fullPage: true,
  });
  await short.getByLabel("想法操作", { exact: true }).click();
  await expect(short.getByText("人生原则", { exact: true })).toBeVisible();
  await short.getByRole("button", { name: "编辑想法", exact: true }).click();
  await page.getByLabel("正文", { exact: true }).fill("先行动，再复盘。");
  await page.getByRole("button", { name: "保存想法", exact: true }).click();
  const edited = page
    .locator(".thought-card")
    .filter({ hasText: "先行动，再复盘。" });
  await edited.getByLabel("想法操作", { exact: true }).click();
  await edited.getByRole("button", { name: "置顶", exact: true }).click();
  await expect(edited.getByLabel("想法操作（已置顶）")).toBeVisible();
  await edited.getByLabel("想法操作（已置顶）").click();
  page.once("dialog", (d) => d.accept());
  await edited.getByRole("button", { name: "删除想法", exact: true }).click();
  await expect(edited).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
