import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Cloud, Download, Upload } from "lucide-react";
import { supabase } from "./cloud";
import { dataSchema, type Data } from "./model";
export default function CloudSettings({
  data,
  replace,
  notify,
}: {
  data: Data;
  replace: (d: Data) => boolean;
  notify: (s: string) => void;
}) {
  const [user, setUser] = useState<User | null>(null),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false);
  const revision = useRef<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) notify(error.message);
      setUser(data.session?.user || null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      revision.current = null;
    });
    return () => subscription.unsubscribe();
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(`云端操作失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="section-title">
        <Cloud size={20} />
        <h2>跨设备同步</h2>
        <span className="tag">{supabase ? "已配置" : "可选"}</span>
      </div>
      <p className="muted">
        采用手动同步：在另一台设备使用前下载，编辑后上传。并发修改会被拦截，避免静默覆盖。
      </p>
      {!supabase ? (
        <p className="hint">
          当前未配置 Supabase，本地功能可正常使用。按 README
          配置环境变量与数据库，即可启用邮箱登录。
        </p>
      ) : user ? (
        <>
          <p className="hint">
            当前账号：{user.email}
            。本地数据不会因登录自动上传或切换；共享设备使用后请退出并清理本地副本。
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  !confirm(
                    "下载将替换当前浏览器的数据。请先导出本地备份，是否继续？",
                  )
                )
                  return;
                run(async () => {
                  const { data: row, error } = await supabase!
                    .from("daymark_snapshots")
                    .select("payload,revision")
                    .eq("user_id", user.id)
                    .maybeSingle();
                  if (error) throw error;
                  if (!row) {
                    revision.current = 0;
                    notify("云端尚无数据，可以上传本地内容。");
                    return;
                  }
                  const parsed = dataSchema.parse(row.payload);
                  if (replace(parsed)) {
                    revision.current = row.revision;
                    notify("已下载并保存到本地");
                  }
                });
              }}
            >
              <Download size={16} />
              下载云端数据
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (revision.current === null) {
                    const { data: row, error } = await supabase!
                      .from("daymark_snapshots")
                      .select("revision")
                      .eq("user_id", user.id)
                      .maybeSingle();
                    if (error) throw error;
                    if (row)
                      throw new Error(
                        "请先下载云端数据，再编辑与上传。上传前可先导出本地备份。",
                      );
                    revision.current = 0;
                  }
                  const { data: next, error } = await supabase!.rpc(
                    "save_daymark",
                    { expected_revision: revision.current, new_payload: data },
                  );
                  if (error) throw error;
                  revision.current = next;
                  notify("全部数据已上传到云端");
                })
              }
            >
              <Upload size={16} />
              上传本地数据
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await supabase!.auth.signOut();
                  if (error) throw error;
                  notify("已退出，当前浏览器仍保留本地副本");
                })
              }
            >
              退出登录
            </button>
          </div>
        </>
      ) : (
        <form
          className="button-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const { error } = await supabase!.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: location.origin + import.meta.env.BASE_URL,
                },
              });
              if (error) throw error;
              notify("登录链接已发送，请查看邮箱");
            });
          }}
        >
          <input
            aria-label="登录邮箱"
            required
            type="email"
            placeholder="你的邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy} className="primary">
            {busy ? "发送中…" : "发送登录链接"}
          </button>
        </form>
      )}
    </section>
  );
}
