# 自托管说明

## 初始化

```bash
npm install
npm run build
```

## 环境变量

复制 `.env.example` 到 `.env.local`，并填写以下配置：

- GitHub OAuth
- SMTP 服务
- SQLite 文件路径

## 启动

开发环境：

```bash
npm run dev
```

生产环境：

```bash
npm run build
npm run start
```

## 说明

- 未登录用户的数据只保存在浏览器本地。
- 登录用户的工作台数据会写入 SQLite。
- 第一版不再内置默认 RPC 节点。
- 首次使用时，需要在页面顶部添加 EVM 或 Cosmos Provider。
- EVM Provider 需要填写 RPC URL。
- Cosmos Provider 需要填写 RPC URL 和 REST URL。
- 当前激活的 Provider 会被同步到 Cookie，用于驱动服务端页面和工具请求。
- SQLite 表由应用启动时自动初始化，不再维护 Drizzle migration 文件。
