import { z } from "zod";
import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  isValid,
  parseISO,
} from "date-fns";
export const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  isValid(parseISO(s)) &&
  format(parseISO(s), "yyyy-MM-dd") === s;
const date = z.string().refine(isDate, "日期格式无效");
const timestamp = z.string().datetime();
const id = z.string().min(1).max(100);
export const taskSchema = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  date,
  notes: z.string().max(10000),
  time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  done: z.boolean(),
  createdAt: timestamp,
  order: z.number().finite(),
});
export const thoughtSchema = z.object({
  id,
  title: z.string().max(200),
  body: z.string().trim().min(1).max(50000),
  category: z.string().min(1).max(50),
  pinned: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const dataSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(taskSchema).max(50000),
    journals: z.record(date, z.string().max(50000)),
    thoughts: z.array(thoughtSchema).max(10000),
  })
  .superRefine((d, ctx) => {
    for (const items of [d.tasks, d.thoughts])
      if (new Set(items.map((x) => x.id)).size !== items.length)
        ctx.addIssue({ code: "custom", message: "存在重复 ID" });
  });
export type Task = z.infer<typeof taskSchema>;
export type Thought = z.infer<typeof thoughtSchema>;
export type Data = z.infer<typeof dataSchema>;
export const emptyData = (): Data => ({
  version: 1,
  tasks: [],
  journals: {},
  thoughts: [],
});
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateKey = (d: Date) => format(d, "yyyy-MM-dd");
export function generateDates(start: string, end: string, weekdays?: number[]) {
  if (!isDate(start) || !isDate(end)) throw new Error("请选择有效日期");
  const count = differenceInCalendarDays(parseISO(end), parseISO(start));
  if (count < 0) throw new Error("结束日期不能早于开始日期");
  if (count > 365) throw new Error("每批最多安排 366 天");
  return Array.from({ length: count + 1 }, (_, i) =>
    addDays(parseISO(start), i),
  )
    .filter((d) => !weekdays || weekdays.includes(getDay(d)))
    .map(dateKey);
}
export function progress(tasks: Pick<Task, "done">[]) {
  const total = tasks.length,
    done = tasks.filter((t) => t.done).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    state:
      total && done === total
        ? "complete"
        : done
          ? "partial"
          : total
            ? "pending"
            : "empty",
  };
}
export function createTasks(
  dates: string[],
  fields: Pick<Task, "title" | "notes" | "time">,
  order: number,
): Task[] {
  return [...new Set(dates)].map((date, i) => ({
    ...fields,
    id: crypto.randomUUID(),
    date,
    done: false,
    createdAt: new Date().toISOString(),
    order: order + i,
  }));
}
export const STORAGE_KEY = "daymark.data.v1";
export function readData(
  storage: Pick<Storage, "getItem"> = localStorage,
): Data {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? dataSchema.parse(JSON.parse(raw)) : emptyData();
}
export function saveData(
  data: Data,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(dataSchema.parse(data)));
}
export function parseBackup(raw: string): Data {
  if (raw.length > 15_000_000) throw new Error("备份文件不能超过 15 MB");
  return dataSchema.parse(JSON.parse(raw));
}
