# Daymark

管理时间、执行任务、记录生活、沉淀思想。中文、响应式、支持离线的个人生活管理应用。

## 本地启动

需要 Node.js 22.12+（建议 Node 22 LTS）及 npm。

```sh
npm ci
npm run dev
```

打开终端输出的本地地址。正式构建与检查：

```sh
npm test
npm run build
npm run preview
```

浏览器测试使用本机 Microsoft Edge：`npm run test:e2e`。没有 Edge 时安装 Playwright Chromium (`npx playwright install chromium`)，并删除 `playwright.config.ts` 中的 `channel: 'msedge'`。

## 已实现

- 今日：快速新增、编辑、单日删除、完成/撤销、菜单上下移动排序、日期选择与进度。
- 批量安排：单日、连续范围、多个不连续日期、范围内按星期；每批最多 366 天，每个实例具有独立 ID 与完成状态。保存时防连续提交。
- 日历：跨月/跨年导航，全部完成绿色、部分完成橙色、未完成灰色标记、无任务不标绿。点击日期进入任务页。
- 思想库：单一正文、分类、创建/编辑时间、置顶、搜索、编辑与删除。旧条目的标题显示为正文第一段，编辑保存后合并，已有内容不会丢失。
- 今日记录：每个日期独立的自由文本，即时保存，可留空。
- 设置：亮色/暗色/跟随系统；JSON 导出、严格验证后确认替换导入；可选 Supabase 邮箱登录与手动同步。
- PWA：安装图标、应用清单、离线静态缓存、版本更新提示。首次联网访问正式构建后才可离线。

不提供演示假数据；首次打开为空白个人空间。默认进入日历总览；桌面侧栏和手机底部导航均按日历、今日、思想库、设置排序。手机任务弹窗固定宽度，只允许纵向滚动。应用使用单页面内状态导航，不依赖服务器 URL 重写。

## 数据与安全

本地数据保存在 `localStorage['daymark.data.v1']`，仅限当前源、浏览器与设备。清理站点数据、隐私浏览、磁盘故障都可能造成丢失。请在设置中定期导出 JSON。导入是**替换而不是合并**，验证失败不会改变原始数据；覆盖前会要求确认。损坏的存储会暂停写入，可在设置导出原始数据，随后导入有效备份恢复。

任务日期是 `YYYY-MM-DD` 日历日期，不将其转换成 UTC；“今天”按 Asia/Shanghai 计算。任务时间是无时区的计划时刻，不是通知提醒。创建/编辑时间是 ISO 时间戳。

结构：`{version:1, tasks:Task[], journals:Record<日期,正文>, thoughts:Thought[]}`。批量规则仅用于生成实例，之后没有无限重复引擎。文本通过 React 转义显示，不执行 HTML。

## GitHub Pages 自动部署

当前项目已经包含 `.github/workflows/deploy.yml`，默认监听 `main`。先在 GitHub 建立仓库，再在本地执行（替换地址）：

```sh
git add .
git commit -m "Build Daymark personal life manager"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/Daymark.git
git push -u origin main
```

如果已有 remote，请用 `git remote -v` 检查并跳过添加。仓库 Settings → Pages → Source 选择 **GitHub Actions**。推送后查看 Actions 的构建与部署结果，成功后访问 `https://YOUR_NAME.github.io/Daymark/`。用户主页仓库和自定义域名也由 `configure-pages` 输出自动决定根路径。

工作流自动执行 `npm ci`、单元测试与构建，并从 Pages 配置读取子路径。Vite、资源和 PWA 均使用这个 base。浏览器测试需本机 Edge，未加入部署工作流。GitHub Pages 仅托管静态文件，不提供数据存储。

手动验证子路径（PowerShell）：

```powershell
$env:BASE_PATH='/Daymark/'
npm run build
npm run preview
Remove-Item Env:BASE_PATH
```

访问预览地址下 `/Daymark/`。修改 `.env` 后必须重新构建。

## 可选 Supabase

未配置时可直接使用所有本地功能。

1. 创建 Supabase 项目。在 SQL Editor 执行 `supabase/schema.sql`。
2. Authentication → Providers 启用 Email。在 URL Configuration 将 Site URL 及允许的 Redirect URL 设置为准确的部署地址（包含仓库子路径与末尾 `/`）；开发时加入 `http://127.0.0.1:5173/`。
3. 复制 `.env.example` 为 `.env.local`，填写项目 URL 与 **anon / publishable 公钥**，绝不可使用 `service_role`、数据库密码或管理员密钥。
4. 本地重启 Vite。GitHub 部署时在 Settings → Secrets and variables → Actions → Variables 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，重新运行工作流。它们是构建进前端的公开连接参数，数据保护依赖 RLS。
5. 设置页输入邮箱，打开邮件中的登录链接。新账号可上传本地数据；有云端数据的账号必须先下载，再编辑上传。下载会替换本地数据，先导出备份。

用户身份由 `auth.users` 管理；快照表以 `user_id` 为主键。RLS 仅允许读取当前用户行；客户端无直接插入/更新/删除权限。写入通过 `save_daymark` 函数，只使用 `auth.uid()`，并原子比较版本号。两个设备同时编辑时，后上传的旧版本被拒绝，不能静默覆盖。此时先导出本地备份，再下载云端数据并手动处理差异。

**同步是显式手动操作，不是实时自动同步**。登录不自动上传、下载或切换本地数据；退出后本地副本保留。共享设备应备份后清除站点数据。无需登录也能离线使用本地模式。云端操作需要联网。首次邮箱发送可能受 Supabase 邮件限流影响。

## 项目目录

```text
src/
  App.tsx              页面、导航与本地状态
  components.tsx       日历、任务/想法编辑器、对话框
  model.ts             数据类型、验证、日期生成、进度、存储
  model.test.ts        核心逻辑测试
  cloud.ts             可选 Supabase 客户端
  CloudSettings.tsx    登录与版本控制同步
  styles.css           响应式界面和主题
e2e/app.spec.ts         桌面与触屏浏览器验收
public/                PWA 图标
supabase/schema.sql    数据库、RLS 与原子写入函数
.github/workflows/     GitHub Pages 自动构建发布
```

## 限制与未来扩展

- 本地存储容量由浏览器决定（通常仅数 MB），适合个人文字记录；保存失败会提示。备份文件上限 15 MB，仍可能因浏览器实际配额而无法导入。
- 云端采用整份快照、手动同步与乐观并发控制，不进行逐条自动合并。多个本地窗口同时提交仍有极小的竞态窗口，建议在一个窗口编辑。
- 不含通知提醒、图片、富文本、无限重复、团队协作、AI 或复杂分析。
- 手机触屏视口由 Edge 自动化验证；真实 iOS Safari、Android Chrome、主屏幕安装和真实 Supabase 账号仍需设备/服务验收。
- 后续可考虑 IndexedDB、可配置时区、逐条云同步、自定义分类编辑与每周回顾。

实际测试和构建结果见 `VERIFICATION.md`。

生产环境的子路径与离线验证：先按上面的 PowerShell 命令构建 `/Daymark/` 版本，再运行 `npm run test:e2e -- --config=playwright.production.config.ts`。该配置会启动同子路径的预览服务器并在测试结束后关闭。

界面截图在 `artifacts/`，其中任务内容仅由测试创建，不会预置到实际应用中。
