# 仓库工作规范

## 项目结构与模块组织

本仓库是一个 Next.js App Router 项目，主要应用代码位于 `src/`。

- `src/app`：路由、布局和 API handlers
- `src/components`：可复用 UI 基础组件
- `src/domains`：EVM 和 Cosmos 领域查询、格式化逻辑和 UI 模块
- `src/platform`：导航、搜索、workbench 和共享产品逻辑
- `src/server`：服务端仓库、认证辅助函数和响应工具
- `src/db`：Drizzle schema 和数据库客户端
- `public`：品牌 SVG、图标等静态资源
- `docs`：项目和部署文档

`ethereum-tool/` 和 `cosmos-tool/` 是旧版参考项目，不要在其中新增代码。

## 构建、测试与开发命令

- `npm run dev`：启动本地 Next.js 开发服务器
- `npm run build`：创建生产构建
- `npm run start`：运行生产服务器
- `npm run lint`：对应用和配置文件运行 ESLint
- `npm run typecheck`：运行 TypeScript 类型检查，不输出文件

推送到 `main` 前，运行 `npm run typecheck` 和 `npm run build`。

## Agent 工作流注意事项

- 不要在每个小改动后默认运行 `npx eslint`、`npm run lint`、`npm run typecheck` 或 `npm run build`。
- 只有当用户明确要求 `commit`、`push`、PR，或明确要求验证时，才运行上述检查命令。
- 除非用户明确批准，不要删除 `.next`。如果 `npm run dev` 正在运行，删除 `.next` 可能破坏当前开发服务器。
- 活跃本地开发期间，避免执行破坏性清理操作。如果确实需要清理缓存，先说明影响，并让用户有意重启开发服务器。
- 不要在服务端存储任何区块链数据。
- 所有链上数据必须从浏览器客户端，使用用户提供或当前选中的 Provider，直接发起 RPC/REST 请求。
- 不要让 `src/app/api`、`src/server` 或任何服务端代码请求链 RPC/REST。
- 不要为链上读取添加 backend proxy、server-side decode route、server-side RPC client、server-side REST client，除非用户明确要求改成这种架构。
- 不要在服务端设计或新增链状态、区块、交易、验证人、提案等链上数据的持久化、快照或索引，除非用户明确改变这条规则。
- 链查询和链数据解码优先放在客户端执行。只有账号、配置、标签、草稿、收藏等非链上数据可以通过后端接口读写。
- 如果发现后端代码正在触链，必须优先改成浏览器客户端直连 Provider，而不是继续沿用后端转发。
- 默认不要在用户输入过程中自动写入 `localStorage`。涉及表单、工具页、草稿缓存等本地持久化时，只有在用户点击明确按钮后才保存，例如 `Save`、`Broadcast`、`Submit`、`Import` 等。

## 编码风格与命名规范

使用 TypeScript，并且只使用 ES module 语法。除非框架约定要求默认导出，否则优先使用 named exports。

- 组件：`PascalCase`
- Hooks 和 helper：`camelCase`
- 路由目录：小写，遵循 Next.js 风格
- 共享 UI 放在 `src/components`
- 功能专属 UI 放在 `src/domains`

样式基于 Tailwind。选择器、下拉菜单等控件优先使用 shadcn 风格基础组件，不要自定义原生 dropdown 样式。

默认情况下，toolbar、card header、form footer 等操作区域中的 action buttons 靠右对齐，除非具体页面明显需要其它布局。

表格 action 列如果使用仅图标按钮，图标之间保持紧凑且零间距，每个图标按钮使用紧凑的 `3px` 视觉 padding，并使用即时显示的自定义 tooltip，不要依赖浏览器延迟显示的原生 `title`。

所有 tooltip 统一使用项目内的自定义 tooltip 组件，不要使用原生 `title` 属性。包括但不限于表格单元格、文本截断提示、状态提示、图标按钮和复制反馈。

默认情况下，数据表格单元格内容保持单行。不要让 age、amount、address、gas label 等值换行。表格宽度超出容器时，优先使用横向滚动，而不是文本换行。

所有 copy / 复制交互默认都要提供即时成功反馈，例如显示短暂的 `Copied` 提示；不要只复制不反馈。

## 测试规范

当前第一版还没有自动化测试套件。在引入测试前，使用以下命令验证：

- `npm run lint`
- `npm run typecheck`
- `npm run build`

以后添加测试时，将测试放在相关模块附近，或放在专门的测试目录中，并使用清晰的 `*.test.ts` 或 `*.test.tsx` 命名。

## Commit 与 Push 规范

除非用户明确说“提交”“commit”“推送”“push”或等价指令，否则不要执行 `git add`、`git commit`、`git push`。

Commit message 使用英文 Conventional Commits，例如：

- `feat: add rpc provider selector`
- `fix: remove default cosmos rpc fallback`

本项目不使用 Pull Request，直接推送到 `main`。

推送到 `main` 前，如有相关验证，请在交付说明或任务记录中包含运行过的关键验证命令。
