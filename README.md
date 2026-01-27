# Telegram 公开频道消息监控服务

一个部署在 **Cloudflare Pages + Functions + KV** 上的免费 Telegram 频道监控服务，使用网页抓取方式实时监控公开频道的新消息，并将其转发到指定的目标频道。

## ✨ 核心功能

- 🆓 **完全免费**：使用 Cloudflare 免费计划，无额外费用
- 🔒 **安全可靠**：使用环境变量存储敏感信息，避免 Token 泄露
- 🌐 **全球部署**：Cloudflare 全球边缘节点，响应迅速
- 📡 **实时监控**：定期检查频道新消息，实时转发
- 🎯 **多频道支持**：同时监控多个公开频道（建议 ≤ 2个，避免执行超时）
- 📤 **自动转发**：识别并转发文本和媒体消息（图片、视频等）
- 🚫 **自动去重**：使用 KV 存储历史记录，避免重复转发
- 📊 **详细日志**：完整的执行日志，便于排查问题
- 🛠️ **错误处理**：完善的错误诊断和重试机制
- 🔄 **无需登录**：使用网页抓取方式，无需 Telegram API ID 和登录

## 🛠️ 技术栈

| 技术 | 用途 | 说明 |
|------|------|------|
| **JavaScript** | 主要开发语言 | Cloudflare Pages Functions 支持的语言 |
| **Cloudflare Pages** | 部署平台 | 提供静态网站托管和 Functions 功能 |
| **Cloudflare KV** | 存储服务 | 存储消息历史记录，实现自动去重 |
| **Telegram Bot API** | 消息发送 | 用于将消息转发到目标频道 |
| **Fetch API** | 网络请求 | 用于网页抓取和 API 调用 |
| **正则表达式** | HTML 解析 | 提取 Telegram 频道页面中的消息 |
| **环境变量** | 配置管理 | 安全存储敏感信息（Bot Token、频道 ID 等） |

## 📋 环境要求

- **Cloudflare 免费账户**：用于部署 Pages 项目和 KV 存储
- **Telegram 账号**：用于创建机器人和管理频道
- **GitHub/GitLab 账户**：用于代码托管和 Pages 部署（可选）

## 🚀 部署步骤

### 步骤 1：准备工作

1. **创建 Cloudflare 账户**（如果没有）：
   - 访问 [Cloudflare 官网](https://www.cloudflare.com) 注册免费账户

2. **创建 Telegram 机器人**（获取 Bot Token）：
   - 在 Telegram 中搜索 `@BotFather`
   - 发送 `/newbot` 命令创建新机器人
   - 按照提示设置机器人名称和用户名
   - 获取机器人 Token（如：`123456789:ABCdefGhIjKlMnOpQrStUvWxYz123456`）

3. **获取目标频道 ID**：
   - 创建或选择一个私密频道作为目标频道
   - 将机器人添加到该频道，并设置为管理员
   - 发送一条消息到频道
   - 使用 `@userinfobot` 获取频道 ID（格式：`-100xxxxxxxxxx`）

### 步骤 2：创建 Cloudflare KV 命名空间

1. **登录 Cloudflare 控制台**
2. **导航到 Workers & Pages** → **KV**
3. **创建命名空间**：
   - 名称：`telegram_monitor_history`
   - 点击 "Create"

### 步骤 3：部署 Pages 项目

#### 方法 A：使用 GitHub/GitLab 自动部署（推荐）

1. **Fork 本仓库**：
   - 点击 GitHub 页面右上角的 "Fork" 按钮
   - 选择你的账户，创建分支

2. **在 Cloudflare 控制台**：
   - 导航到 **Workers & Pages** → **Pages**
   - 点击 "Create a Project" → "Connect to Git"
   - 选择你的仓库，点击 "Begin setup"

3. **配置构建设置**：
   - 项目名称：`telegram-monitor`
   - 生产分支：`main`
   - 构建命令：`npm run build`
   - 构建输出目录：留空（使用默认值）
   - 点击 "Save and Deploy"

4. **设置环境变量**：
   - 部署完成后，进入项目 → **Settings** → **Environment Variables**
   - **添加生产环境变量**：

   | 变量名 | 值 | 说明 |
   |-------|-----|------|
   | `BOT_TOKEN` | `你的机器人Token` | Telegram 机器人 Token |
   | `TARGET_CHANNEL` | `-1001234567890` | 目标频道 ID |
   | `SOURCE_CHANNELS` | `[ ["频道用户名1", "频道ID1"], ["频道用户名2", "频道ID2"] ]` | 源频道配置（JSON 格式，最多 2个） |

   - 点击 "Save"

5. **绑定 KV 命名空间**：
   - 进入项目 → **Settings** → **Functions** → **KV Namespaces Bindings**
   - **添加绑定**：
     - Variable name: `MESSAGE_HISTORY`
     - KV namespace: `telegram_monitor_history`（选择你创建的命名空间）
   - 点击 "Save"

#### 方法 B：手动部署

1. **克隆本仓库**：
   ```bash
   git clone https://github.com/Lusanren/telegram-monitor.git
   cd telegram-monitor
   ```

2. **安装 Wrangler CLI**：
   ```bash
   npm install -g wrangler
   ```

3. **登录 Cloudflare**：
   ```bash
   wrangler login
   ```

4. **配置 wrangler.toml**：
   创建 `wrangler.toml` 文件：
   ```toml
   name = "telegram-monitor"
   main = "functions/monitor.js"
   compatibility_date = "2023-12-01"
   
   [[kv_namespaces]]
   binding = "MESSAGE_HISTORY"
   id = "你的KV命名空间ID"
   preview_id = "你的KV命名空间预览ID"
   ```

5. **部署**：
   ```bash
   wrangler pages deploy .
   ```

6. **设置环境变量**：
   参考方法 A 中的步骤 4

### 步骤 4：配置定时触发

由于 Cloudflare Pages 免费计划不支持 Scheduled Workers，我们需要使用外部调度器定期触发监控服务。

#### 推荐的免费外部调度器

| 服务名称 | 免费额度 | 最低触发间隔 | 配置方法 |
|---------|---------|------------|----------|
| **cron-job.org** | 无限任务 | 1分钟 | [配置教程](#cron-joborg-配置)
| **EasyCron** | 3个免费任务 | 1分钟 | [配置教程](#easycron-配置)
| **宝塔面板计划任务** | 无限任务 | 1分钟 | [配置教程](#宝塔面板计划任务-配置)
| **GitHub Actions** | 无限任务 | 1分钟 | [配置教程](#github-actions-配置)

#### cron-job.org 配置

1. **注册账户**：访问 [cron-job.org](https://cron-job.org) 注册免费账户
2. **创建任务**：
   - Title: `Telegram Monitor`
   - URL: `https://你的-pages-域名.pages.dev/monitor`
   - Schedule: `Every 10 minutes`（每10分钟执行一次）
   - HTTP Method: `GET`
   - Timeout: `30` 秒
   - Retries: `1` 次
   - Retry delay: `60` 秒
3. **点击 "Create"** 保存任务

#### EasyCron 配置

1. **注册账户**：访问 [EasyCron](https://www.easycron.com) 注册免费账户
2. **创建任务**：
   - Cron Expression: `*/10 * * * *`（每10分钟执行一次）
   - URL: `https://你的-pages-域名.pages.dev/monitor`
   - HTTP Method: `GET`
   - Timeout: `30` 秒
3. **点击 "Create Cron Job"** 保存任务

#### 宝塔面板计划任务配置

1. **登录宝塔面板**：访问 `http://你的服务器IP:8888`
2. **创建任务**：
   - 任务类型: `Shell脚本`
   - 任务名称: `Telegram 频道监控`
   - 执行周期: `N分钟`
   - 执行周期数: `10`
   - 脚本内容:
     ```bash
     #!/bin/bash
     
     MONITOR_URL="https://你的-pages-域名.pages.dev/monitor"
     
     echo "=== 执行 Telegram 频道监控 ==="
     echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
     echo "监控 URL: $MONITOR_URL"
     
     # 发送请求
     response=$(curl -s -w "\n%{http_code}" -m 30 "$MONITOR_URL")
     
     # 提取状态码和响应体
     body=$(echo "$response" | head -n -1)
     status_code=$(echo "$response" | tail -n 1)
     
     echo "响应状态码: $status_code"
     echo "响应内容: $body"
     echo "=== 监控任务完成 ==="
     ```
3. **点击 "添加任务"** 保存

#### GitHub Actions 配置

1. **在你的仓库**中创建 `.github/workflows/monitor.yml` 文件：
   ```yaml
   name: Telegram Channel Monitor
   
   on:
     schedule:
       - cron: '*/10 * * * *'  # 每10分钟执行一次
     workflow_dispatch:  # 允许手动触发
   
   jobs:
     monitor:
       runs-on: ubuntu-latest
       
       steps:
         - name: Checkout repository
           uses: actions/checkout@v3
         
         - name: Trigger monitor function
           run: |
             echo "Triggering Telegram channel monitor..."
             curl -s -w "\nStatus code: %{http_code}\n" -m 30 "https://你的-pages-域名.pages.dev/monitor"
   ```

2. **提交文件**到仓库，GitHub Actions 会自动按照设定的时间执行

## 📡 监控端点

部署完成后，监控服务的访问端点为：

```
https://你的-pages-域名.pages.dev/monitor
```

### 端点说明

- **HTTP 方法**：`GET` 或 `POST`
- **响应格式**：`application/json`
- **响应状态码**：
  - `200`：监控任务执行成功
  - `500`：服务器内部错误（如缺少环境变量）
- **响应内容**：包含执行状态、时间戳、监控结果等详细信息

### 示例响应

```json
{
  "status": "completed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "summary": {
    "totalChannels": 2,
    "successCount": 2,
    "failureCount": 0,
    "totalNewMessages": 3,
    "totalForwardedMessages": 3
  },
  "details": [
    {
      "channel": "channel1",
      "channelId": "-1001234567890",
      "success": true,
      "totalMessages": 20,
      "newMessages": 2,
      "forwardedMessages": 2,
      "error": null
    },
    {
      "channel": "channel2",
      "channelId": "-1009876543210",
      "success": true,
      "totalMessages": 15,
      "newMessages": 1,
      "forwardedMessages": 1,
      "error": null
    }
  ],
  "message": "Telegram 频道监控任务执行完成"
}
```

## 🔧 配置示例

### 监控单个频道

```json
[
  ["telegram", "-1001234567890"]
]
```

### 监控多个频道（最多 2个）

```json
[
  ["telegram", "-1001234567890"],
  ["openai", "-1009876543210"]
]
```

### 注意事项

- **频道用户名**：是 `t.me/频道名` 中的 `频道名` 部分
- **频道 ID**：格式为 `-100xxxxxxxxxx`，用于标识频道（可选，主要用于日志显示）
- **监控数量**：建议最多监控 2个频道，避免执行时间超过 10秒限制
- **触发间隔**：建议每 10-15分钟触发一次，平衡实时性和频率限制

## 📊 日志查看

1. **Cloudflare Pages 日志**：
   - 登录 Cloudflare 控制台
   - 导航到你的 Pages 项目 → **Functions** → **Logs**
   - 查看执行日志，了解监控服务的运行状态

2. **外部调度器日志**：
   - 登录你使用的调度器服务
   - 查看任务执行历史和日志
   - 确认任务是否成功触发监控服务

## 🚫 常见问题与解决方案

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| **执行超时（10秒）** | 监控频道过多或网络请求太慢 | 减少监控频道数量（≤ 2个），增加触发间隔（≥ 10分钟） |
| **消息不转发** | Bot Token 错误或目标频道 ID 错误 | 验证 Bot Token 和频道 ID，确保机器人是目标频道管理员 |
| **消息重复转发** | KV 存储操作失败或历史记录丢失 | 检查 KV 命名空间绑定是否正确，重新初始化历史记录 |
| **无法获取频道消息** | 源频道不是公开频道或网络错误 | 确保源频道是公开的，检查网络连接是否正常 |
| **Telegram API 错误** | 触发频率限制或权限不足 | 增加消息发送间隔（≥ 1秒），检查机器人权限 |
| **环境变量未生效** | 环境变量配置错误或未保存 | 重新检查环境变量配置，确保格式正确，点击 "Save" 保存 |
| **KV 存储错误** | KV 命名空间绑定错误或额度用尽 | 检查 KV 绑定是否正确，确保未超出免费额度（1GB 存储） |

## 🔒 安全最佳实践

1. **使用环境变量**：所有敏感信息（Bot Token、频道 ID 等）必须存储在环境变量中，不得硬编码在代码中

2. **定期轮换 Token**：如果担心 Token 可能已泄露，在 BotFather 中重新生成 Token

3. **限制机器人权限**：只授予机器人必要的权限，不要授予管理员权限（除非必要）

4. **监控机器人活动**：定期检查机器人的消息发送记录，发现异常及时处理

5. **使用私有仓库**：如果代码包含敏感逻辑，考虑使用私有仓库而不是公开仓库

6. **设置合理触发间隔**：避免过于频繁的触发，减少被 Telegram 限制的风险

7. **启用 HTTPS**：Cloudflare Pages 默认启用 HTTPS，确保传输安全

8. **使用 .gitignore**：确保不会意外提交敏感文件到仓库

## ⚡ 性能优化

1. **减少监控频道数量**：最多监控 2个频道，避免执行超时

2. **合理设置触发间隔**：每 10-15分钟触发一次，平衡实时性和系统负载

3. **优化网络请求**：
   - 设置合理的超时时间（5秒）
   - 使用 HTTP/2（Cloudflare 自动支持）
   - 避免重定向，直接使用 `https://t.me/s/频道名` 格式

4. **简化 HTML 解析**：使用正则表达式替代 cheerio，减少包大小和解析时间

5. **批量处理消息**：减少 KV 读写次数，批量处理消息历史

6. **限制历史记录大小**：每个频道历史记录限制为 50条，减少 KV 存储使用

7. **错误处理优化**：实现指数退避策略，当请求失败时逐渐增加重试间隔

## 📈 预期效果

- **实时性**：消息发布后 10-15分钟内转发到目标频道
- **可靠性**：99.9% 以上的执行成功率（依赖网络状况）
- **准确性**：准确识别和转发文本、图片、视频等消息
- **稳定性**：24/7 稳定运行，自动处理各种异常情况
- **安全性**：敏感信息安全存储，避免泄露风险

## 🆓 免费额度说明

| 服务 | 免费额度 | 是否足够 |
|------|---------|----------|
| **Cloudflare Pages** | 无限请求，10秒执行时间 | ✅ 足够 |
| **Cloudflare KV** | 1GB 存储，10万次读取/天，1万次写入/天 | ✅ 足够 |
| **Telegram Bot API** | 无明确限制（合理使用） | ✅ 足够 |
| **外部调度器** | 免费计划（如 cron-job.org 无限任务） | ✅ 足够 |

## 🔄 部署更新

1. **更新代码**：
   - 修改代码后，提交到 GitHub/GitLab 仓库
   - Cloudflare Pages 会自动检测并重新部署

2. **更新配置**：
   - 在 Cloudflare 控制台中修改环境变量
   - 无需重新部署，修改后立即生效

3. **更新依赖**：
   - 修改 `package.json` 中的依赖版本
   - 提交更新，触发重新部署

## 📁 项目结构

```
telegram-monitor/
├── functions/           # Cloudflare Pages Functions
│   └── monitor.js       # 核心监控代码
├── .gitignore           # Git 忽略文件配置
├── package.json         # 项目配置和依赖
├── README.md            # 项目说明文档
└── LICENSE              # 许可证文件
```

## 📄 许可证

本项目采用 **MIT 许可证**，详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request，帮助改进这个项目！

1. **Fork 本仓库**
2. **创建分支**：`git checkout -b feature/your-feature`
3. **提交更改**：`git commit -m 'Add your feature'`
4. **推送到分支**：`git push origin feature/your-feature`
5. **创建 Pull Request**

## 🙏 鸣谢

- **Cloudflare**：提供免费的 Pages、Functions 和 KV 服务
- **Telegram**：提供 Bot API 和频道服务
- **所有贡献者**：感谢你们的支持和贡献

## 📞 支持

如果遇到问题，请：

1. **查看日志**：检查 Cloudflare Pages 和调度器的执行日志
2. **阅读文档**：仔细阅读本 README.md 文件中的配置步骤和常见问题
3. **提交 Issue**：在 GitHub 仓库中提交 Issue，详细描述问题和错误信息
4. **社区支持**：在相关社区（如 Telegram 中文社区）寻求帮助

---

**使用提示**：本服务仅用于合法目的，请遵守相关法律法规和 Telegram 的使用条款。

**享受免费、安全、稳定的 Telegram 频道监控服务！** 🎉