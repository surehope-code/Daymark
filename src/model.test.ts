import { describe, it, expect } from "vitest";
import { addMonths, parseISO } from "date-fns";
import {
  createTasks,
  dateKey,
  emptyData,
  generateDates,
  parseBackup,
  progress,
  readData,
  saveData,
} from "./model";
describe("批量日期", () => {
  it("生成连续 30 天，包含两端", () => {
    const dates = generateDates("2026-10-19", "2026-11-17");
    expect(dates).toHaveLength(30);
    expect(dates.at(-1)).toBe("2026-11-17");
  });
  it("只包含周一、三、五", () =>
    expect(generateDates("2026-10-19", "2026-10-25", [1, 3, 5])).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]));
  it("支持闰年与跨年", () => {
    expect(generateDates("2024-02-28", "2024-03-01")).toHaveLength(3);
    expect(generateDates("2026-12-31", "2027-01-01")).toHaveLength(2);
    expect(dateKey(addMonths(parseISO("2026-12-01"), 1))).toBe("2027-01-01");
  });
  it("拒绝无效、倒置和超长日期", () => {
    expect(() => generateDates("2026-02-30", "2026-03-01")).toThrow();
    expect(() => generateDates("2026-10-20", "2026-10-19")).toThrow();
    expect(() => generateDates("2026-01-01", "2028-01-01")).toThrow();
  });
  it("多个日期去重，完成状态独立", () => {
    const tasks = createTasks(
      ["2026-10-19", "2026-10-20", "2026-10-19"],
      { title: "学习英语", notes: "", time: "" },
      0,
    );
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).not.toBe(tasks[1].id);
    tasks[0].done = true;
    expect(tasks[1].done).toBe(false);
  });
});
describe("完成率与颜色", () => {
  it("空日期不能变绿", () =>
    expect(progress([])).toEqual({
      total: 0,
      done: 0,
      percent: 0,
      state: "empty",
    }));
  it("有任务但零完成", () =>
    expect(progress([{ done: false }]).state).toBe("pending"));
  it("3/5 为 60%，全部完成才变绿，撤销后恢复橙色", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({ done: i < 3 }));
    expect(progress(tasks).percent).toBe(60);
    tasks.forEach((t) => (t.done = true));
    expect(progress(tasks).state).toBe("complete");
    tasks[0].done = false;
    expect(progress(tasks).state).toBe("partial");
  });
  it("9/10 不能变绿，即使比例四舍五入为100也不能变绿", () => {
    expect(
      progress(Array.from({ length: 10 }, (_, i) => ({ done: i < 9 }))).state,
    ).toBe("partial");
    expect(
      progress(Array.from({ length: 1000 }, (_, i) => ({ done: i < 999 })))
        .state,
    ).toBe("partial");
  });
});
describe("持久化与备份安全", () => {
  it("保存后能重新加载任务、记录与想法", () => {
    const d = emptyData();
    d.tasks = createTasks(
      ["2026-10-18"],
      { title: "读书", time: "09:30", notes: "" },
      0,
    );
    d.journals["2026-10-18"] = "平静的一天";
    d.thoughts = [
      {
        id: "a",
        title: "行动",
        body: "每天一步",
        category: "人生原则",
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    let raw = "";
    const storage = {
      setItem: (_k: string, v: string) => (raw = v),
      getItem: () => raw,
    };
    saveData(d, storage);
    expect(readData(storage)).toEqual(d);
    expect(parseBackup(raw)).toEqual(d);
  });
  it("拒绝无效版本、日期、重复 ID、空任务标题", () => {
    expect(() => parseBackup('{"version":2}')).toThrow();
    const d = emptyData();
    d.journals.bad = "x";
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    d.journals = {};
    d.tasks = createTasks(
      ["2026-10-18"],
      { title: "读书", time: "", notes: "" },
      0,
    );
    d.tasks.push(d.tasks[0]);
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    d.tasks = [{ ...d.tasks[0], title: "" }];
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });
});
