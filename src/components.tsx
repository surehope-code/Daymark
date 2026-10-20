import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  createTasks,
  dateKey,
  generateDates,
  progress,
  today,
  type Task,
  type Thought,
} from "./model";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Calendar({
  month,
  selected,
  tasks,
  onSelect,
  onMonth,
  compact = false,
}: {
  month: string;
  selected: string;
  tasks: Task[];
  onSelect: (s: string) => void;
  onMonth: (s: string) => void;
  compact?: boolean;
}) {
  const d = parseISO(month),
    days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(d), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(d), { weekStartsOn: 1 }),
    });
  const grouped = new Map<string, Task[]>();
  tasks.forEach((t) =>
    grouped.set(t.date, [...(grouped.get(t.date) || []), t]),
  );
  return (
    <div className={compact ? "calendar compact" : "calendar"}>
      <div className="calendar-head">
        <strong>{format(d, "yyyy 年 M 月")}</strong>
        <div className="flex items-center gap-1">
          <button
            className="icon"
            aria-label="上个月"
            onClick={() => onMonth(dateKey(addMonths(d, -1)))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon"
            aria-label="下个月"
            onClick={() => onMonth(dateKey(addMonths(d, 1)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["一", "二", "三", "四", "五", "六", "日"].map((x) => (
          <span className="weekday" key={x}>
            {x}
          </span>
        ))}
        {days.map((day) => {
          const key = dateKey(day),
            p = progress(grouped.get(key) || []);
          return (
            <button
              key={key}
              aria-label={`${key}，${p.total ? `${p.done}/${p.total} 已完成` : "暂无任务"}`}
              aria-current={key === today() ? "date" : undefined}
              onClick={() => onSelect(key)}
              className={`day ${p.state} ${!isSameMonth(day, d) ? "outside" : ""} ${key === selected ? "selected" : ""} ${key === today() ? "today" : ""}`}
            >
              <span>{format(day, "d")}</span>
              {!compact && (
                <small>{p.total ? `${p.done} / ${p.total}` : "—"}</small>
              )}
              {compact && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function TaskEditor({
  task,
  date,
  order,
  onSave,
  onClose,
}: {
  task?: Task;
  date: string;
  order: number;
  onSave: (tasks: Task[]) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title || ""),
    [notes, setNotes] = useState(task?.notes || ""),
    [time, setTime] = useState(task?.time || ""),
    [mode, setMode] = useState("single"),
    [start, setStart] = useState(task?.date || date),
    [end, setEnd] = useState(date),
    [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]),
    [multiple, setMultiple] = useState<string[]>([date]),
    [error, setError] = useState("");
  const lock = useRef(false);
  let dates: string[] = [],
    dateError = "";
  try {
    dates =
      mode === "multiple"
        ? [...multiple].sort()
        : mode === "single"
          ? [start]
          : generateDates(start, end, mode === "weekly" ? days : undefined);
  } catch (e) {
    dateError = (e as Error).message;
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (dateError || !dates.length) {
      setError(dateError || "请至少选择一个日期");
      return;
    }
    lock.current = true;
    const fields = { title: title.trim(), notes, time };
    const ok = onSave(
      task
        ? [{ ...task, ...fields, date: start }]
        : createTasks(dates, fields, order),
    );
    if (ok) onClose();
    else lock.current = false;
  }
  return (
    <Modal title={task ? "编辑任务" : "安排一件事"} onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <label>
          任务名称
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="想做些什么？"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {!task && (
          <label>
            安排方式
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="single">当天 / 指定某一天</option>
              <option value="range">连续日期范围 · 每天</option>
              <option value="multiple">多个不连续日期</option>
              <option value="weekly">日期范围内按星期重复</option>
            </select>
          </label>
        )}
        <div className="form-row">
          <label>
            {mode === "multiple" ? "选择日期" : "开始 / 任务日期"}
            <input
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          {["range", "weekly"].includes(mode) && (
            <label>
              结束日期
              <input
                type="date"
                required
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          )}
          {mode === "multiple" && (
            <button
              type="button"
              className="secondary self-end"
              onClick={() => {
                if (start && !multiple.includes(start))
                  setMultiple([...multiple, start]);
              }}
            >
              <Plus size={16} />
              加入日期
            </button>
          )}
        </div>
        {mode === "multiple" && (
          <div className="chips">
            {[...multiple].sort().map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setMultiple(multiple.filter((x) => x !== d))}
              >
                {d}
                <X size={14} />
              </button>
            ))}
          </div>
        )}
        {mode === "weekly" && (
          <div className="week-choices">
            {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
              <button
                type="button"
                aria-pressed={days.includes(d)}
                className={days.includes(d) ? "active" : ""}
                key={d}
                onClick={() =>
                  setDays(
                    days.includes(d)
                      ? days.filter((x) => x !== d)
                      : [...days, d],
                  )
                }
              >
                {["一", "二", "三", "四", "五", "六", "日"][i]}
              </button>
            ))}
          </div>
        )}
        <label>
          计划时间 <span className="muted">（可选）</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          备注 <span className="muted">（可选）</span>
          <textarea
            rows={3}
            maxLength={10000}
            placeholder="留一点提醒给自己…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="muted text-sm">
          {task
            ? "仅修改这一天的任务。"
            : dateError ||
              `将创建 ${dates.length} 个独立任务，每天的完成状态互不影响。`}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="primary"
            disabled={!title.trim() || !!dateError || !dates.length}
          >
            <Check size={17} />
            保存任务
          </button>
        </div>
      </form>
    </Modal>
  );
}
export const categories = [
  "人生原则",
  "个人信条",
  "生活感悟",
  "自我反思",
  "其他",
];
export function ThoughtEditor({
  thought,
  onSave,
  onClose,
}: {
  thought?: Thought;
  onSave: (t: Thought) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(thought?.title || ""),
    [body, setBody] = useState(thought?.body || ""),
    [category, setCategory] = useState(thought?.category || categories[0]);
  return (
    <Modal title={thought ? "编辑想法" : "留下一点想法"} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const now = new Date().toISOString();
          if (
            onSave({
              id: thought?.id || crypto.randomUUID(),
              title,
              body: body.trim(),
              category,
              pinned: thought?.pinned || false,
              createdAt: thought?.createdAt || now,
              updatedAt: now,
            })
          )
            onClose();
        }}
      >
        <label>
          标题（可选）
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="为这个想法起个名字"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          正文
          <textarea
            required
            rows={8}
            maxLength={50000}
            value={body}
            placeholder="那些值得记住的，写在这里。"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label>
          分类
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[...new Set([...categories, category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button disabled={!body.trim()} className="primary">
            保存想法
          </button>
        </div>
      </form>
    </Modal>
  );
}
