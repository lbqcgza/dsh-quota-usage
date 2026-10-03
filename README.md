# dsh-quota-usage

在 DSH Web 界面**侧边栏底部、用户名正上方**显示 DeepSeek 账号**剩余额度**（充值余额 + 赠送余额）的小组件。

- **位置**：占 `sidebar.footer.action` 槽位。侧边栏底部的渲染顺序是
  `sidebar.footer.action`（上）→ `sidebar.settings`（下，账号 launcher 显示头像与用户名），
  所以本组件就贴在用户名上面。
- **全局**：该槽位是 root 作用域，跟随侧边栏常驻，**任何面板/页面**都可见。
- **数据源**：官方账号 Remote 命名空间 `remote.account` 的 `getBalance`，与「设置 → 账号」页同源；
  不落盘、不接触 token、不做本地估算。
- **纯 UI 插件**：host 半侧是空的 `apply`，只为让包在 Loader 里占一行；全部逻辑在浏览器半侧。

## 显示效果

展开状态：

```
  额度                    ¥13.34（赠¥1.00）     ← 本组件（用户名上方）
  ⚙ 设置
  (头像) 张三                                    ← 账号 launcher / 用户名
```

- **主数值 = 总余额**，即 Platform 的 `normal_wallets`（官方账号页标为「充值余额」）
  与 `bonus_wallets`（官方标为「赠金余额」）在该币种下的**合计**。
- **括号内 = 赠送余额**；为 0 时整个括号不显示。
- 悬停提示给出拆分：`总余额 ¥13.34 · 充值余额 ¥12.34 · 赠金余额 ¥1.00 · 更新于 14:32 · 点击刷新`。
- 点击整行 = 立即刷新。
- 收起为 56px 轨道时（macOS/Web）显示 36px 圆形简版；Windows 原生标题栏下侧边栏收起时
  整个底部区域由 shell 隐藏，与用户名行一同隐藏。

### 每个阶段都会显示

**组件不会因为拿不到数据而静默消失** —— 一个悄悄不出现的组件和一个坏掉的插件无法区分。
所以每种状态都有明确文案：

| 阶段 | 显示 | 含义 |
| --- | --- | --- |
| `loading` | 读取中… | 首次读取尚未返回 |
| `ready` | `¥13.34（赠¥1.00）` | 正常 |
| `failed` | 读取失败 | Remote 调用失败（保留上一次有效数字） |
| `unavailable` | 未连接 | 页面还没有 `remote.account` 服务，正在快速重试 |
| `signed-out` | 未登录 | Host 侧没有可用凭证，`getBalance` 返回 `null` |

## 三个必须知道的技术点

这三点都是实际调试得出的，不是推测：

### 1. 账号命名空间要用 `ctx.get("remote.account")` 取

API gateway 把每个 Remote 命名空间注册成**独立的 Cordis 服务**，key 是
`` `remote.${namespace}` ``（`RemoteNamespaceService extends Service`，见
`@deepseek-ai/dsh-api-gateway/client`）。所以规范查找是 `ctx.get("remote.account")`；
`ctx.remote.account` 只是嵌套访问器，在没有注入该 dotted key 的上下文里可能拿不到值。
本插件按 `ctx.get("remote.account")` → `ctx.remote.account` → `ctx["remote.account"]` 依次回退。

`inject` 里**故意不声明** `"remote.account"`：声明一个在某些部署下不存在的服务会让 fiber
一直 pending，而 shell 的启动审计把 pending 也算作失败（见下）。

### 2. `apply` 抛异常 = 整个页面启动失败

shell 的启动审计（`web boot: N entry did not activate`）在任一条目 fiber 不是 `active`
时**中止整个启动**。桌面版随后报告 web-boot 崩溃
（`%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`），
而启动器的恢复流程会**重写 profile**（丢掉 `dsh.profile.bundles` 里的额外条目和
`cordis.patch.yml` 里的覆盖项）。

所以本插件的 `apply` **永不向外抛异常**：每个挂载步骤都被隔离，失败时记一笔 trace 并让插件保持惰性，
绝不让一个小组件拖垮整个 App。

### 3. 新装的客户端插件必须重启桌面 App

桌面壳（`lib/main.js`）把 SPA 的 `index.html` 静态送出，启动图（boot injections，即
`window.__DSH_BOOT__` 里的客户端模块表）只在 **host 启动时取一次**：

```js
const ready = await host.start();
injections = ready.injections;          // 只在 App 启动时算一次
ipcMain.handle(DESKTOP_IPC.boot, () => ({ injections, streamBaseUrl }));
```

所以**新加一行**客户端模块后，刷新页面也拿不到它的 bundle（Loader 条目已是 active，但页面手里
的模块表是旧的）。`dsh web` 的浏览器模式则刷新页面就会重新渲染启动图。

**但一旦这一行已存在**，通过插件页 / `plugin_manager` 停用再启用会触发页面重新同步并重新加载该模块，
不需要重启。

## 自诊断

出问题时不需要猜：

- **挂载失败**：trace 会以 `shell.overlay` 的 occupant id 形式留在页面里，读法：

  ```js
  // 客户端 Slot 检查
  listSubTree({ root: "shell.overlay" })
  // → { id: "dsh-quota-usage-diag:bind=ok | dict=ok | store=ok | start=ok | mirror=ok | seat=!<错误>" }
  ```

  同时有一行 `console.error("dsh-quota-usage: mount failed — …")`。

- **读数未就绪**：只要阶段不是 `ready`，它会把自己镜像成
  `shell.overlay` 的 `dsh-quota-usage-state:<phase>` 条目；拿到金额后自动撤下。
  所以「overlay 里没有 state 条目」= 那一路没有跑起来；「有 state 条目」= 跑起来了但卡在该阶段。

## 安装

```powershell
# 在 DSH 里（Creator 模式）用 plugin_manager 工具：
#   install_bundle  target = <本目录绝对路径>
```

本目录自带 `cordis.patch.yml`，安装后作为 bundle 被选中并插入一行 Loader 条目：

```yaml
- insert:
    - id: dsh-quota-usage
      name: dsh-quota-usage
```

装好后**重启一次 DeepSeek Harness**（原因是上面第 3 点）。重启后小组件出现在侧边栏底部、
用户名正上方。

## 刷新策略

- 挂载时读一次；**未拿到首个结果前每 5 秒重试**（账号命名空间可能比本插件晚挂载），
  拿到后转为每 60 秒；
- 页面重新可见、窗口获得焦点、连接重置时重读；
- 订阅 `account.watch` 账号状态流，登录/登出后立刻重读。

## 目录

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包名、`dsh.bundle.patch`、`dsh.client`（`platform: web`、依赖排序 `inject`） |
| `cordis.patch.yml` | bundle 层：插入 Loader 条目 |
| `lib/index.js` | host 半侧：空 `apply`，仅占位 |
| `lib/client.js` | 浏览器半侧：样式、字典、额度 store、`QuotaRow` 组件、槽位注册、自诊断 |
| `test/smoke.mjs` | 离线冒烟测试：桩件模拟客户端运行时 |

## 开发与验证

```powershell
node --check lib/client.js     # 语法
node test/smoke.mjs            # 行为冒烟测试
```

`test/smoke.mjs` 用桩件跑真实的 `lib/client.js`，断言：槽位与 props、就绪/轨道/亚分/
未登录/失败/USD 各状态渲染、每请求元数据、未就绪阶段镜像、挂载失败留痕、重复挂载容忍。

改完 `lib/client.js` 后，在插件页或 `plugin_manager` 里停用再启用该插件即可让页面重新加载
（无需重启 App）。

## 已知限制

- 只读展示，不提供充值/跳转（Platform 原生页面由 `ui-settings-account` 的 `shell.overlay`
  共享宿主条目独占，第三方插件不应另起一个）。
- 赠送余额与充值余额取同一币种；多币种并存时优先 CNY，否则取第一个钱包的币种。
- 金额按 Platform Web 口径显示：两位小数、千分位、正的亚分显示为 `<0.01`。
  这只是**展示格式化**，原始余额字符串不被改写。
- 桌面版新增模块行仍需重启一次 App 才能进启动图（第 3 点）。
