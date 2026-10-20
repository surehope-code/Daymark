import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Edit3,
  Feather,
  HardDrive,
  Leaf,
  ListTodo,
  Moon,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Calendar, categories, TaskEditor, ThoughtEditor } from "./components";
import CloudSettings from "./CloudSettings";
import {
  createTasks,
  dateKey,
  emptyData,
  parseBackup,
  progress,
  readData,
  saveData,
  STORAGE_KEY,
  today,
  type Data,
  type Task,
  type Thought,
} from "./model";
type Page = "today" | "calendar" | "thoughts" | "settings";
const nav = [
  { id: "today" as Page, label: "今日", icon: ListTodo },
  { id: "calendar" as Page, label: "日历", icon: CalendarDays },
  { id: "thoughts" as Page, label: "思想库", icon: BookOpen },
  { id: "settings" as Page, label: "设置", icon: Settings },
];
function initial() {
  try {
    return { data: readData(), error: "" };
  } catch {
    return {
      data: emptyData(),
      error:
        "本地数据无法读取。为保护原始内容，写入已暂停。请到设置下载原始数据或导入有效备份恢复。",
    };
  }
}
export default function App() {
  const [boot] = useState(initial),
    [data, setData] = useState<Data>(boot.data),
    [storageError, setStorageError] = useState(boot.error),
    [page, setPage] = useState<Page>("today"),
    [date, setDate] = useState(today),
    [month, setMonth] = useState(today),
    [taskEditor, setTaskEditor] = useState<Task | "new" | null>(null),
    [thoughtEditor, setThoughtEditor] = useState<Thought | "new" | null>(null),
    [quick, setQuick] = useState(""),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [filter, setFilter] = useState("全部"),
    [journalOpen, setJournalOpen] = useState(false),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("daymark.theme") || "system";
      } catch {
        return "system";
      }
    });
  const current = useRef(data),
    blocked = useRef(!!boot.error),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    [journalDraft, setJournalDraft] = useState<string | null>(null);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      document
        .querySelectorAll<HTMLDetailsElement>(".task-menu[open]")
        .forEach((menu) => {
          if (!menu.contains(event.target as Node)) menu.open = false;
        });
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);
  useEffect(() => {
    if (journalDraft === null) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [journalDraft]);
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 5000);
  }
  function commit(fn: (d: Data) => Data, recover = false) {
    if (blocked.current && !recover) {
      notify("写入已暂停，请先恢复本地数据");
      return false;
    }
    try {
      const base = recover ? current.current : readData();
      const next = fn(base);
      saveData(next);
      current.current = next;
      setData(next);
      blocked.current = false;
      setStorageError("");
      return true;
    } catch {
      notify("保存失败：存储空间不足、不可用或数据无效。请导出备份。");
      return false;
    }
  }
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const next = readData();
          current.current = next;
          setData(next);
        } catch {
          blocked.current = true;
          setStorageError("另一窗口写入的数据无法读取，已暂停保存。");
        }
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (m.matches ? "dark" : "light") : theme);
    apply();
    m.addEventListener("change", apply);
    try {
      localStorage.setItem("daymark.theme", theme);
    } catch {}
    return () => m.removeEventListener("change", apply);
  }, [theme]);
  const tasks = data.tasks
      .filter((t) => t.date === date)
      .sort((a, b) => a.order - b.order),
    p = progress(tasks),
    pending = tasks.filter((t) => !t.done),
    done = tasks.filter((t) => t.done),
    shown = filter === "未完成" ? pending : filter === "已完成" ? done : tasks;
  function navigateDate(d: string) {
    if (
      journalDraft !== null &&
      !confirm("今日记录尚未保存，离开会丢弃这段未保存内容。是否继续？")
    )
      return;
    setJournalDraft(null);
    setDate(d);
    setMonth(d);
    setPage("today");
  }
  function removeTask(t: Task) {
    if (
      confirm(`删除“${t.title}”？仅删除 ${t.date} 的这一项。`) &&
      commit((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
    )
      notify("任务已删除");
  }
  function reorder(task: Task, delta: number) {
    const i = tasks.findIndex((t) => t.id === task.id),
      other = tasks[i + delta];
    if (!other) return;
    commit((d) => {
      const ids = tasks.map((t) => t.id);
      [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
      return {
        ...d,
        tasks: d.tasks.map((t) =>
          ids.includes(t.id) ? { ...t, order: ids.indexOf(t.id) } : t,
        ),
      };
    });
  }
  function download(raw: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const thoughts = data.thoughts
    .filter(
      (t) =>
        (category === "全部" || t.category === category) &&
        `${t.title} ${t.body}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigateDate(today());
          }}
        >
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span>
            Daymark<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="brand-caption">给每一天，留下印记。</p>
        <div className="nav-label">我的空间</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              onClick={() => setPage(n.id)}
              className={page === n.id ? "active" : ""}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "today" && (
                <span className="nav-count">
                  {
                    data.tasks.filter((t) => t.date === today() && !t.done)
                      .length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Leaf size={21} />
            <p>
              把注意力放在当下，
              <br />
              让小小的行动慢慢生长。
            </p>
          </div>
          <div className="local-badge">
            <span className="status-dot" />
            本地工作空间
            <HardDrive size={14} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            个人空间 <span className="slash">/</span>{" "}
            {nav.find((n) => n.id === page)?.label}
          </span>
          <div className="flex items-center gap-3">
            <span className="desktop-only text-xs muted">
              时间有迹，生活有序
            </span>
            <button
              className="icon"
              aria-label="切换亮暗主题"
              onClick={() =>
                setTheme(
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              <Sun size={18} />
            </button>
            <span className="avatar">我</span>
          </div>
        </header>
        <main>
          {storageError && (
            <div role="alert" className="error-banner">
              {storageError}
            </div>
          )}
          {needRefresh && (
            <div className="hint">
              新版本已就绪。
              <button
                className="text-button"
                onClick={() => updateServiceWorker(true)}
              >
                更新应用
              </button>
            </div>
          )}
          {page === "today" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">把时间留给重要的事</div>
                  <h1>
                    {date === today()
                      ? "把今天，过得从容一点。"
                      : format(parseISO(date), "M 月 d 日", { locale: zhCN }) +
                        "，一步一步来。"}
                  </h1>
                  <p className="muted">不必做完所有事，先做好重要的事。</p>
                </div>
                <button
                  className="primary"
                  onClick={() => setTaskEditor("new")}
                >
                  <Plus size={18} />
                  新建任务
                </button>
              </div>
              <div className="today-layout">
                <div className="main-column">
                  <section className="panel task-panel">
                    <div className="day-header">
                      <div>
                        <div className="date-title">
                          {format(parseISO(date), "M 月 d 日")}
                          <span>
                            {format(parseISO(date), "EEEE", { locale: zhCN })}
                          </span>
                          {date === today() && <b className="tag">今天</b>}
                        </div>
                        <div className="muted text-xs mt-2">
                          {format(parseISO(date), "yyyy 年")} ·
                          把计划变成生活的一部分
                        </div>
                      </div>
                      <div className="date-controls">
                        <button
                          className="icon"
                          aria-label="前一天"
                          onClick={() =>
                            navigateDate(dateKey(addDays(parseISO(date), -1)))
                          }
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <label
                          className="date-picker"
                          aria-label="选择任务日期"
                        >
                          <CalendarDays size={17} />
                          <input
                            aria-label="选择任务日期"
                            type="date"
                            value={date}
                            onChange={(e) => {
                              if (e.target.value) navigateDate(e.target.value);
                            }}
                          />
                        </label>
                        <button
                          className="icon"
                          aria-label="后一天"
                          onClick={() =>
                            navigateDate(dateKey(addDays(parseISO(date), 1)))
                          }
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="progress-section">
                      <div className="flex justify-between items-center">
                        <span className="text-sm muted">
                          今日进度{" "}
                          <strong className="progress-number">
                            {p.done}
                            <span> / {p.total}</span>
                          </strong>
                        </span>
                        <span className="progress-label">
                          {p.total ? `${p.percent}%` : "暂无任务"}
                        </span>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label="当日完成进度"
                        aria-valuenow={p.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div style={{ width: `${p.percent}%` }} />
                      </div>
                      <p className="text-xs muted mt-3">
                        {p.state === "complete"
                          ? "今天的计划都完成了，给自己一点肯定。"
                          : p.done
                            ? "每一步，都算数。继续保持自己的节奏。"
                            : "新的一天，从一件小事开始。"}
                      </p>
                    </div>
                    <div className="task-toolbar">
                      <div className="tabs">
                        {["全部", "未完成", "已完成"].map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={filter === f ? "active" : ""}
                          >
                            {f}
                            {f === "全部" && <span>{tasks.length}</span>}
                          </button>
                        ))}
                      </div>
                      <span className="muted text-xs">
                        {pending.length} 项待办
                      </span>
                    </div>
                    <form
                      className="quick-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!quick.trim()) return;
                        const added = createTasks(
                          [date],
                          { title: quick.trim(), notes: "", time: "" },
                          Math.max(0, ...data.tasks.map((t) => t.order)) + 1,
                        );
                        if (
                          commit((d) => ({
                            ...d,
                            tasks: [...d.tasks, ...added],
                          }))
                        ) {
                          setQuick("");
                          notify("任务已添加");
                        }
                      }}
                    >
                      <Plus size={19} />
                      <input
                        aria-label="快速添加任务"
                        maxLength={200}
                        value={quick}
                        onChange={(e) => setQuick(e.target.value)}
                        placeholder="添加任务，让今天更有方向…"
                      />
                      <button
                        aria-label="添加任务"
                        disabled={!quick.trim()}
                        type="submit"
                      >
                        添加 <span className="desktop-only">↵</span>
                      </button>
                    </form>
                    <div className="task-list">
                      {shown.length ? (
                        shown.map((t) => (
                          <div
                            className={`task-row ${t.done ? "is-done" : ""}`}
                            key={t.id}
                          >
                            <button
                              className="task-check"
                              aria-label={`${t.done ? "撤销完成" : "完成"}：${t.title}`}
                              aria-pressed={t.done}
                              onClick={() =>
                                commit((d) => ({
                                  ...d,
                                  tasks: d.tasks.map((x) =>
                                    x.id === t.id ? { ...x, done: !x.done } : x,
                                  ),
                                }))
                              }
                            >
                              {t.done && <Check size={15} />}
                            </button>
                            <button
                              className="task-content"
                              onClick={() => setTaskEditor(t)}
                            >
                              <span className="task-title">{t.title}</span>
                              {(t.time || t.notes) && (
                                <span className="task-meta">
                                  {t.time && <span>{t.time}</span>}
                                  {t.notes && (
                                    <span className="truncate">{t.notes}</span>
                                  )}
                                </span>
                              )}
                            </button>
                            <details
                              className="task-menu"
                              name="task-actions"
                              onClick={(event) => {
                                if ((event.target as Element).closest("button"))
                                  event.currentTarget.open = false;
                              }}
                            >
                              <summary aria-label={`操作：${t.title}`}>
                                <MoreHorizontal size={19} />
                              </summary>
                              <div className="menu-popover">
                                <button onClick={() => setTaskEditor(t)}>
                                  <Edit3 size={15} />
                                  编辑
                                </button>
                                <button
                                  disabled={tasks[0]?.id === t.id}
                                  onClick={() => reorder(t, -1)}
                                >
                                  <ArrowUp size={15} />
                                  上移
                                </button>
                                <button
                                  disabled={tasks.at(-1)?.id === t.id}
                                  onClick={() => reorder(t, 1)}
                                >
                                  <ArrowDown size={15} />
                                  下移
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => removeTask(t)}
                                >
                                  <Trash2 size={15} />
                                  删除
                                </button>
                              </div>
                            </details>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">
                          <div className="empty-icon">
                            <ListTodo size={28} strokeWidth={1.4} />
                          </div>
                          <h3>
                            {tasks.length
                              ? "这里暂时没有任务"
                              : "留一点空间，给今天的计划"}
                          </h3>
                          <p>
                            {tasks.length
                              ? "试试切换上方的任务筛选。"
                              : "在上方写下第一件事，或安排一段时间的日常。"}
                          </p>
                          {!tasks.length && (
                            <button
                              className="text-button"
                              onClick={() => setTaskEditor("new")}
                            >
                              安排我的第一件事 <ArrowUpRight size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="task-footer">
                      <ShieldCheck size={14} />
                      {storageError
                        ? "本地保存已暂停"
                        : "每一次勾选，都会即时保存在当前浏览器"}
                    </div>
                  </section>
                  <section className="panel journal">
                    <button
                      className="journal-toggle"
                      aria-expanded={journalOpen}
                      onClick={() => setJournalOpen(!journalOpen)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="journal-icon">
                          <Feather size={19} />
                        </span>
                        <span>
                          <strong>今日记录</strong>
                          <small>
                            {data.journals[date]
                              ? "留住今天，随时续写"
                              : "心情、收获，或一个小小的瞬间"}
                          </small>
                        </span>
                      </span>
                      <ChevronDown
                        size={18}
                        className={journalOpen ? "rotate-180" : ""}
                      />
                    </button>
                    {journalOpen && (
                      <div className="journal-body">
                        <textarea
                          aria-label="今日记录"
                          rows={6}
                          maxLength={50000}
                          placeholder="今天有什么值得记住的事？"
                          value={journalDraft ?? data.journals[date] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setJournalDraft(value);
                            if (
                              commit((d) => ({
                                ...d,
                                journals: { ...d.journals, [date]: value },
                              }))
                            )
                              setJournalDraft(null);
                          }}
                        />
                        <p className="muted text-xs">
                          {journalDraft !== null
                            ? "尚未保存，请检查浏览器存储空间。"
                            : "自动保存 · 只属于这一天"}
                        </p>
                      </div>
                    )}
                  </section>
                </div>
                <aside className="right-column">
                  <section className="panel">
                    <Calendar
                      month={month}
                      selected={date}
                      tasks={data.tasks}
                      onSelect={navigateDate}
                      onMonth={setMonth}
                      compact
                    />
                    <div className="calendar-legend">
                      <span>
                        <i className="green" />
                        已完成
                      </span>
                      <span>
                        <i className="amber" />
                        进行中
                      </span>
                      <button
                        className="text-button"
                        onClick={() => navigateDate(today())}
                      >
                        回到今天
                      </button>
                    </div>
                  </section>
                  <section className="reflection-card">
                    <div className="flex items-center gap-2 text-xs">
                      <Leaf size={15} /> 给自己的一句话
                    </div>
                    <blockquote>
                      {data.thoughts
                        .find((t) => t.pinned)
                        ?.body.slice(0, 150) ||
                        "生活的改变，藏在每一天微小而坚定的行动里。"}
                    </blockquote>
                    <button onClick={() => setPage("thoughts")}>
                      去思想库，沉淀更多 <ArrowUpRight size={15} />
                    </button>
                  </section>
                  <p className="side-note">
                    留白也是计划的一部分。
                    <br />
                    按照自己的节奏，慢慢来。
                  </p>
                </aside>
              </div>
            </>
          )}
          {page === "calendar" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">每一天，都有一点进步</div>
                  <h1>日子里的每一步。</h1>
                  <p className="muted">回看坚持，也为未来留一点期待。</p>
                </div>
                <button className="secondary" onClick={() => setMonth(today())}>
                  回到本月
                </button>
              </div>
              <section className="panel full-calendar">
                <Calendar
                  month={month}
                  selected={date}
                  tasks={data.tasks}
                  onSelect={navigateDate}
                  onMonth={setMonth}
                />
                <div className="calendar-legend">
                  <span>
                    <i className="green" />
                    全部完成
                  </span>
                  <span>
                    <i className="amber" />
                    部分完成
                  </span>
                  <span>
                    <i />
                    有任务未完成
                  </span>
                  <span>— 暂无任务</span>
                </div>
                <p className="muted text-xs mt-4">
                  点击日期，查看和安排当天任务。
                </p>
              </section>
            </>
          )}
          {page === "thoughts" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">值得留下的想法</div>
                  <h1>让想法，慢慢生根。</h1>
                  <p className="muted">
                    收藏你的原则、感悟，与一路走来的自己。
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setThoughtEditor("new")}
                >
                  <Plus size={18} />
                  记录想法
                </button>
              </div>
              <div className="thought-controls">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="搜索思想库"
                    placeholder="搜索一个想法…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="筛选分类"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "全部",
                    ...new Set([
                      ...categories,
                      ...data.thoughts.map((t) => t.category),
                    ]),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="thought-grid">
                {thoughts.map((t) => (
                  <article className="panel thought-card" key={t.id}>
                    <div className="flex justify-between items-center">
                      <span className="tag">{t.category}</span>
                      <button
                        className={`icon ${t.pinned ? "pinned" : ""}`}
                        aria-label={t.pinned ? "取消置顶" : "置顶"}
                        aria-pressed={t.pinned}
                        onClick={() =>
                          commit((d) => ({
                            ...d,
                            thoughts: d.thoughts.map((x) =>
                              x.id === t.id
                                ? {
                                    ...x,
                                    pinned: !x.pinned,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : x,
                            ),
                          }))
                        }
                      >
                        <Pin size={16} />
                      </button>
                    </div>
                    <h2>{t.title || "无题"}</h2>
                    <p className="thought-body">{t.body}</p>
                    <footer>
                      <span
                        className="muted text-xs"
                        title={`创建：${new Date(t.createdAt).toLocaleString("zh-CN")}；编辑：${new Date(t.updatedAt).toLocaleString("zh-CN")}`}
                      >
                        {format(parseISO(t.updatedAt), "yyyy.MM.dd")} · 编辑
                      </span>
                      <div className="flex">
                        <button
                          className="icon"
                          aria-label="编辑想法"
                          onClick={() => setThoughtEditor(t)}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="icon danger"
                          aria-label="删除想法"
                          onClick={() => {
                            if (confirm("确定删除这条想法？"))
                              commit((d) => ({
                                ...d,
                                thoughts: d.thoughts.filter(
                                  (x) => x.id !== t.id,
                                ),
                              }));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
              {!thoughts.length && (
                <div className="panel empty-state">
                  <BookOpen size={32} strokeWidth={1.4} />
                  <h3>
                    {query || category !== "全部"
                      ? "没有找到对应的想法"
                      : "留住那些照亮你的想法"}
                  </h3>
                  <p>一句原则、一点感悟，都值得被记住。</p>
                  <button
                    className="text-button"
                    onClick={() => setThoughtEditor("new")}
                  >
                    写下一个想法 <Plus size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">我的空间，我的节奏</div>
                  <h1>让这里，更像你。</h1>
                  <p className="muted">安心保存，自在使用。</p>
                </div>
              </div>
              <div className="settings-stack">
                <section className="panel settings-panel">
                  <div className="section-title">
                    <Sun size={20} />
                    <h2>外观与偏好</h2>
                  </div>
                  <div className="setting-line">
                    <div>
                      <strong>界面主题</strong>
                      <p className="muted text-sm">让光线和心情都刚刚好。</p>
                    </div>
                    <div className="theme-options">
                      {[
                        { id: "light", label: "亮色", icon: Sun },
                        { id: "dark", label: "暗色", icon: Moon },
                        { id: "system", label: "跟随系统", icon: Circle },
                      ].map((t) => (
                        <button
                          key={t.id}
                          className={theme === t.id ? "active" : ""}
                          onClick={() => setTheme(t.id)}
                        >
                          <t.icon size={15} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-line">
                    <strong>日历时区</strong>
                    <span className="muted">Asia/Shanghai · 中国标准时间</span>
                  </div>
                </section>
                <section className="panel settings-panel">
                  <div className="section-title">
                    <HardDrive size={20} />
                    <h2>数据与备份</h2>
                    <span className="tag">本地存储</span>
                  </div>
                  <p className="muted">
                    数据仅保存在当前浏览器，不会自动跨设备同步。清除网站数据或使用隐私浏览可能导致丢失，请定期导出备份。
                  </p>
                  <p className="hint">
                    {data.tasks.length} 项任务 · {data.thoughts.length} 条想法 ·{" "}
                    {Object.values(data.journals).filter(Boolean).length}{" "}
                    篇生活记录
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => {
                        download(
                          JSON.stringify(data, null, 2),
                          `daymark-${today()}.json`,
                        );
                        notify("备份文件已生成");
                      }}
                    >
                      <Download size={17} />
                      导出 JSON
                    </button>
                    <label className="secondary upload-label">
                      <Upload size={17} />
                      导入备份
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            if (file.size > 15_000_000)
                              throw new Error("文件超过 15 MB");
                            const imported = parseBackup(await file.text());
                            if (
                              confirm(
                                `导入 ${imported.tasks.length} 项任务和 ${imported.thoughts.length} 条想法，将替换本地全部数据。建议先导出当前备份，是否继续？`,
                              ) &&
                              commit(() => imported, true)
                            ) {
                              setJournalDraft(null);
                              notify("备份已验证并导入");
                            }
                          } catch {
                            notify(
                              "导入失败：文件格式、日期、字段或大小不符合要求。原有数据未改变。",
                            );
                          }
                        }}
                      />
                    </label>
                    {storageError && (
                      <button
                        className="secondary"
                        onClick={() => {
                          try {
                            download(
                              localStorage.getItem(STORAGE_KEY) || "",
                              "daymark-raw-recovery.json",
                            );
                          } catch {
                            notify("浏览器禁止访问存储");
                          }
                        }}
                      >
                        下载原始数据
                      </button>
                    )}
                  </div>
                </section>
                <CloudSettings
                  data={data}
                  replace={(d) => commit(() => d, true)}
                  notify={notify}
                />
                <section className="panel settings-panel">
                  <div className="section-title">
                    <Leaf size={20} />
                    <h2>随时打开 Daymark</h2>
                  </div>
                  <p className="muted">
                    在 iPhone Safari 中选择“分享 → 添加到主屏幕”；在支持的
                    Android
                    或桌面浏览器中选择“安装应用”。首次加载后可离线使用本地功能。
                  </p>
                  <p className="text-xs muted">
                    {offlineReady
                      ? "离线资源已准备就绪。"
                      : "离线缓存将在正式构建首次联网访问后准备。"}{" "}
                    · Daymark 1.0
                  </p>
                </section>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>DAYMARK</span> 一天一点，成为自己。
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={page === n.id ? "active" : ""}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {taskEditor && (
        <TaskEditor
          task={taskEditor === "new" ? undefined : taskEditor}
          date={date}
          order={Math.max(0, ...data.tasks.map((t) => t.order)) + 1}
          onClose={() => setTaskEditor(null)}
          onSave={(items) => {
            const ok = commit((d) => ({
              ...d,
              tasks:
                taskEditor === "new"
                  ? [...d.tasks, ...items]
                  : d.tasks.map((t) => (t.id === items[0].id ? items[0] : t)),
            }));
            if (ok)
              notify(
                taskEditor === "new"
                  ? `已安排 ${items.length} 项任务`
                  : "任务已更新",
              );
            return ok;
          }}
        />
      )}
      {thoughtEditor && (
        <ThoughtEditor
          thought={thoughtEditor === "new" ? undefined : thoughtEditor}
          onClose={() => setThoughtEditor(null)}
          onSave={(t) => {
            const ok = commit((d) => ({
              ...d,
              thoughts:
                thoughtEditor === "new"
                  ? [...d.thoughts, t]
                  : d.thoughts.map((x) => (x.id === t.id ? t : x)),
            }));
            if (ok) notify("想法已保存");
            return ok;
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
