# Chain Dev for EVM & Cosmos

这是一个面向 EVM 与 Cosmos 链的浏览器优先工具站，集成了区块浏览、链上查询和开发者工作台能力。

## 功能概览

- EVM 浏览能力
  - 区块
  - 交易
  - 账户
  - 合约
  - Pending Transactions
- Cosmos 浏览能力
  - 区块
  - 交易
  - 账户
  - 验证人
  - 提案
  - Params
- 工作台能力
  - 自定义 EVM / Cosmos Provider
  - 私钥管理
  - 地址标签
- 内置工具
  - `Signature Lookup`
  - `Wallet Generator`
  - `Bech32`
  - `Keystore`
  - `Hash`
  - `Big Number`
  - `Unit Converter`
  - `EVM RPC API`
  - `Cosmos REST API`

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- NextAuth
- Drizzle ORM
- SQLite
- `viem`
- `@cosmjs/*`

## 目录结构

- `src/app`：路由、布局、API handlers
- `src/platform`：导航、搜索、工作台、工具页和共享产品逻辑
- `src/domains`：EVM 与 Cosmos 领域模块
- `src/components`：通用 UI 组件
- `src/server`：服务端认证与持久化逻辑
- `src/db`：数据库客户端与 schema
- `public`：静态资源
- `docs`：项目文档

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 复制环境变量示例

```bash
cp .env.example .env.local
```

3. 按需修改 `.env.local`

当前应用最少会用到：

- `AUTH_SECRET`
- `DATABASE_URL`

可选的初始化配置：

- `BOOTSTRAP_EVM_PROVIDER`
- `BOOTSTRAP_COSMOS_PROVIDER`
- `BOOTSTRAP_PRIVATE_KEY_NAME`
- `BOOTSTRAP_PRIVATE_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

4. 启动开发环境

```bash
npm run dev
```

默认访问 `http://localhost:3000`。

## 可用命令

- `npm run dev`：启动开发服务器
- `npm run build`：构建生产版本
- `npm run start`：启动生产服务
- `npm run lint`：执行 ESLint
- `npm run typecheck`：执行 TypeScript 类型检查

## 说明

- 链上数据默认由浏览器直接使用当前激活的 Provider 发起请求。
- 当前架构不通过后端代理链上 RPC / REST 查询。
- SQLite 表由应用启动时自动初始化。
- `ethereum-tool/` 与 `cosmos-tool/` 是旧版参考目录，不应继续新增代码。

## 相关文档

- 英文 README：`README.md`
- 自托管说明：`docs/self-hosting.md`
- 前端约定：`docs/frontend-conventions.md`
