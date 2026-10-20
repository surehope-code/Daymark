import { test, expect } from "@playwright/test";
test("GitHub Pages 子路径资源与 PWA 离线刷新", async ({
  page,
  context,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/Daymark/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const manifest = await request.get("/Daymark/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.start_url).toBe("/Daymark/");
  for (const icon of body.icons)
    expect((await request.get("/Daymark/" + icon.src)).ok()).toBe(true);
  await page.getByLabel("快速添加任务").fill("离线也能记录");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("离线也能记录", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "完成：离线也能记录", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "撤销完成：离线也能记录", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
