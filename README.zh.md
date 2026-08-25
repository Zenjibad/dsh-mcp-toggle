# dsh-mcp-toggle · 在 DSH 设置中启用/停用 MCP 服务器

> 在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) 的**设置 → MCP 服务器**页面直接启用/停用 MCP：一个新增设置页，**即时**停止/启动每个 `@deepseek-ai/dsh-mcp-client` 连接（其 `mcp__*` 工具实时注销/注册），并**持久化**到配置，重启后依旧生效。
>
> English: [README.md](README.md) · LLM 索引: [llms.txt](llms.txt) · Agent 指南: [AGENTS.md](AGENTS.md)

![dsh-plugin](https://img.shields.io/badge/dsh--plugin-ready-4c8dff) ![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-✓-0f1115) ![license](https://img.shields.io/badge/license-MIT-green) ![install](https://img.shields.io/badge/dsh%20plugin%20add-✓-22c55e)

**关键词 / Keywords**: `dsh-plugin` · `deepseek-harness-plugin` · mcp · mcp-client · settings · enable · disable · toggle · MCP 服务器 · 启用 · 停用

## 仓库 / Repo

GitHub: [Zenjibad/dsh-mcp-toggle](https://github.com/Zenjibad/dsh-mcp-toggle) · 需要 DSH ≥ 0.1 及 web profile。

---

## 📑 目录

- [✨ 特性](#-特性)
- [🏗️ 工作原理](#️-工作原理)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置](#️-配置)
- [❓ 常见问题](#-常见问题)
- [⚠️ 安全须知](#️-安全须知)
- [📦 项目结构](#-项目结构)
- [🙏 致谢](#-致谢)

---

## ✨ 特性

| 特性 | 说明 |
| --- | --- |
| 🎚️ **MCP 服务器设置页** | 新增设置页（id `mcp-toggle`，顺序 70），列出每个用户配置的 `@deepseek-ai/dsh-mcp-client` 服务器——每行一个开关 |
| 🔄 **即时切换** | 拨动开关即调用 Cordis Loader 的 `Entry.update({disabled})`——MCP 连接 fiber 立刻被销毁（停用）或启动，其 `mcp__*` 工具实时注销/注册，无需重启 DSH |
| 💾 **重启常驻** | 每次变更追加到**home 补丁层**（`$DSH_HOME/cordis.patch.yml`）——该层高于所有 profile，无论 MCP 行来自哪个文件，重启后状态依旧生效 |
| 📊 **状态一目了然** | 每行显示 MCP 服务器名、启用/停用标签、连接阶段（Connected / Stopped / Connecting / Connection failed） |
| 🔒 **安全防护** | loader 的 `include` 条目、非 MCP 条目与本插件自身被防护；未知 id 返回 `404`，锁定 id 返回 `403` |
| 🌗 **主题自适应** | 全部颜色使用 `--dsw-alias-*` 设计令牌，亮/暗色自动跟随 |
| ♨️ **重启常驻** | 真实 profile 打包插件：`dsh plugin add` 安装一次，每次 DSH 启动自动加载 —— 无需 cordis_define、无需每次重装 |

## 🏗️ 工作原理

```
设置 → MCP 服务器（新增页面，id `mcp-toggle`）
                                  │
Client 半区（浏览器）              ▼
  └─ fetch GET /mcp-toggle/api → MCP 客户端条目列表
  └─ 每行一个服务器：名称 + 启用/停用标签 + 连接阶段 + 开关
  └─ 拨动开关 → fetch POST /mcp-toggle/api { entryId, disabled }
                                  │
Host 半区（DSH 进程内）            ▼
  └─ webServer 路由 POST /mcp-toggle/api
  └─ 过滤：entry.options.name === '@deepseek-ai/dsh-mcp-client'
  └─ loader.resolve(entryId).update({ disabled })
       └─ 销毁 mcp-client fiber（停用：连接关闭、mcp__* 工具注销）或启动（启用）——即时生效
  └─ 向 $DSH_HOME/cordis.patch.yml 追加 `- id: <rawId>` / `disabled: <bool>`
       （HOME 用户补丁层，在所有 profile 层之后应用 → 启动时生效）
  └─ 返回 { ok, entryId, serverName, disabled, fiberPhase, persisted }
                                  │
Client 半区（浏览器）              ▼
  └─ toast：「已停用 MCP 服务器 <名称>」/「已启用 …」（或错误信息）→ 刷新列表
```

- **即时与持久化解耦**：`Entry.update()`（条目级）**不会**把 loader 树写回任何配置文件——即时效果只在内存，持久化仅靠追加 home 补丁层。不会打平补丁、不会产生重复行。
- **home 补丁层最高优先级**：web profile 按「bundle → profile `cordis.patch.yml` → HOME `$DSH_HOME/cordis.patch.yml` → overlays」顺序应用补丁。MCP 行分散在 home 与 profile 文件中；写入 **home** 文件的 `disabled` 行对任意来源的 MCP 都生效。两个文件都被 HMR 监听（热应用，无需重启）。
- **持久化**：随包声明 `dsh.bundle`（`cordis.patch.yml`）+ `dsh.client`（`exports["./client"]` 打包产物），作为真实 profile 插件安装，DSH client-modules 每次启动都会扫描加载。

## 🚀 快速开始

### 标准安装：`dsh plugin add`（重启常驻）

从本仓库安装：

```bash
# 本地目录（在本仓库父目录执行）：
dsh plugin --profile web add ./dsh-mcp-toggle

# 或直接从 GitHub（任意 DSH 机器）：
dsh plugin --profile web add github:Zenjibad/dsh-mcp-toggle
# 或：
dsh plugin --profile web add git+https://github.com/Zenjibad/dsh-mcp-toggle.git
```

`dsh plugin add` = 向 profile 做 pnpm add + `dsh.profile.bundles` 协调：识别到本包的 `dsh.bundle` 声明后，把 `dsh-mcp-toggle` 追加进 bundle 栈。**重启 DSH，然后硬刷新浏览器标签页**（`Ctrl+F5`）。启动时 client-modules 扫描器解析 `exports["./client"]`，MCP 服务器页出现在设置中。无需 cordis_define，重启后依旧。

> ⚠️ **注意**：安装（或更新）客户端插件后必须**硬刷新页面**（`Ctrl+F5`）——DSH 客户端 HMR 只会热替换已加载的 bundle，不会把*新增*的 bundle 注入已打开的标签页。

### 手动挂载（备选）

1. `git clone https://github.com/Zenjibad/dsh-mcp-toggle.git`（任意位置）。
2. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加 `"dsh-mcp-toggle": "link:<仓库路径>"`，然后在 profile 目录 `pnpm install`。
3. 重启 DSH。

### 使用前提

- 运行中的 DSH web profile，且配置了至少一个 `@deepseek-ai/dsh-mcp-client` 行（任意用户自定义的服务器名）。
- 未配置任何 MCP 服务器时，页面显示「未配置 MCP 服务器」。

## ⚙️ 配置

无配置文件、无持久化设置。行为由源码中的常量固定：

| 可调项 | 位置 | 默认值 |
| --- | --- | --- |
| HTTP 路由 | `src/index.ts` | `GET|POST /mcp-toggle/api` |
| MCP 插件过滤 | `src/index.ts` 中的 `MCP_CLIENT_PLUGIN` | `@deepseek-ai/dsh-mcp-client` |
| 锁定条目 | `src/index.ts` 中的 `LOCKED` / `LOCKED_NAMES` | `include`、`cordis:include`、`dsh-mcp-toggle` |
| 设置页 | `src/client/index.tsx` | `settings.section` id `mcp-toggle`，顺序 70 |
| Toast 时长 | `src/client/index.tsx` | 6 秒 |
| 持久化目标 | `$DSH_HOME/cordis.patch.yml`（home 补丁层） | 追加行 |

## ❓ 常见问题

**Q: 「MCP 服务器」页面不见了？**
A: 先重启 DSH（如果 Host 半区尚未挂载），再**硬刷新浏览器标签页**（`Ctrl+F5`）。新增的客户端 bundle 只有整页刷新才会加载——HMR 不会把新 bundle 加进已打开的标签页。

**Q: 我停用了服务器但工具还在？**
A: 切换是即时的——mcp-client fiber 被销毁，其工具注册被移除。若该服务器的某个工具仍出现，可能是来自其他服务器（工具名按 `mcp__<服务器>__<工具>` 命名空间隔离），或当前页面会话尚未刷新工具列表。

**Q: 变更能跨重启保留吗？**
A: 可以。每次切换都会向 **home** 补丁层（`$DSH_HOME/cordis.patch.yml`，优先级高于所有 profile 层）追加 `- id: <条目>` / `disabled: <布尔值>`。若追加失败，toast 会提示「未持久化，重启后失效」，仅影响当前会话。

**Q: 为什么有些条目不能切换？**
A: 只列出 `@deepseek-ai/dsh-mcp-client` 行。loader 的 `include` 条目与本插件自身被锁定（`403`）；未知 id 返回 `404`；非 MCP 条目返回 `400`。

**Q: 停用服务器会卸载它吗？**
A: 不会——只是停止 Loader 条目并追加一条 `disabled` 覆盖。MCP 行仍保持配置；重新启用即可再次连接。

**Q: 如何移除本插件本身？**
A: `dsh plugin --profile web rm dsh-mcp-toggle`（或删除 profile 依赖与 bundle 条目）后重启 DSH。之前持久化的 `$DSH_HOME/cordis.patch.yml` 行会保留（那是独立的持久化层）。

## ⚠️ 安全须知

- **无 Remote 通道、不写 loader 配置**：客户端只调用同源 `/mcp-toggle/api` 路由；Host 从不写 `cordis.yml` 或任何 bundle 补丁——只向 home 用户补丁层追加行。
- **输入校验**：`entryId` 必须在 loader 中可解析且必须是 MCP 客户端条目；锁定 id（`include`、自身）返回 `403`；未知 id 返回 `404`。
- **小载荷**：POST 请求体上限 1 MB。
- **即时停止是设计意图**：停用服务器会立刻销毁其 mcp-client fiber——与 `cordis_stop` 相同；重新启用会重启它。

## 📦 项目结构

```
dsh-mcp-toggle/
├── src/
│   ├── index.ts            # host 半区：MCP 条目列表、loader.resolve().update()、home 补丁追加、路由
│   └── client/index.tsx    # client 包：MCP 服务器设置页、开关、toast
├── cordis.patch.yml        # dsh.bundle patch（启动时插入插件行）
├── tsdown.config.ts        # 打包 host（node ESM）+ client（CJS ModuleLoader）
├── package.json            # name、exports["./client"]、dsh.client + dsh.bundle
├── lib/                    # 构建产物（index.js、client.js）
├── AGENTS.md               # AI agent 仓库指南
├── llms.txt / llms-full.txt
├── README.md / README.zh.md
└── LICENSE
```

## 🙏 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 插件/动态运行时、Cordis Loader、Slots、主题、webServer、client-modules、`@deepseek-ai/dsh-mcp-client`。
- [headroom-stats-plugin](https://github.com/Zenjibad/headroom-stats-plugin) — 打包式 client 插件构建模式参考（tsdown host/client 拆分、`cordis.patch.yml`、`dsh.client`）。
- [dsh-plugin-toggle](https://github.com/Zenjibad/dsh-plugin-toggle) — 兄弟插件；插件启停的 Loader 切换机制，本插件将其扩展到 MCP 服务器。

## 📄 License

[MIT](LICENSE)
