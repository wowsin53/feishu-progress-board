# 阿里云 ECS / Ubuntu 24.04 部署

使用 Docker Compose：Node.js 后端与前端同域，Nginx 提供80端口。App Secret 只进入 Node 容器运行时，不进入前端构建。容器支持开机重启与日志轮换。当前没有 ECS 登录信息，文件已准备，尚未执行远程部署。

## 1. 一次性飞书权限配置

飞书私有表格不是公开数据接口。可浏览的链接不等于服务器已获授权；需要创建企业自建应用并赋予读取该 Base 的权限。先开通多维表格读取权限并发布应用，将应用添加到目标表格的可访问应用。后端使用 App ID / App Secret 获取并缓存应用令牌，自动续取，无需每天登录。

本地 `lark-cli` 的用户授权用于检查你的真实字段和联调；它不会自动成为 ECS 的长期应用身份。生产仍需在 ECS 的 `.env` 配置应用凭证，请不要把 Secret 发送到聊天中。

2026-09-13 已完成本地应用凭证与应用身份权限验证：后端直接读取飞书成功，页面接口返回 HTTP 200、`source=feishu`、`checkInSource=mock`，当前共 8 名成员、16 条有效任务。ECS 部署时仍需配置同一应用凭证；更换应用时，在开发者后台的**应用身份权限**中开通 `bitable:app:readonly`（只读）并发布生效，再将应用添加到目标 Base 的可访问应用。

当前表的字段已适配：任务描述作为标题，任务负责人和任务执行人合并去重，进展作为状态，预计完成日期作为截止日期。多选组别优先识别机械／电控／视觉／运营／操作手，重装、飞镖等标签保留；父记录关系保留，子任务以 ↳ 标记。只包含默认开始日期的空白行跳过。待开始显示为未开始；已停滞仍计入未完成；已放弃保留原始记录，不计入未完成、逾期与完成率分母。父子任务分别按独立记录统计。

## 2. 安装 Docker 与 Compose

登录 Ubuntu 24.04 后，按 [Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/) 安装 Docker Engine 和 Compose 插件。确认：

```sh
sudo docker version
sudo docker compose version
```

该方案不需要在宿主机另外安装 Node.js、npm 或飞书 CLI。

## 3. 上传项目

将源码、`package-lock.json`、`Dockerfile`、`compose.yaml`、`deploy/` 等上传到 `/opt/robomaster-dashboard`。不要上传本机 `node_modules`、`.npm-cache`、`.tools`、`.env` 或测试截图。也可从自己的私有 Git 仓库拉取。

```sh
cd /opt/robomaster-dashboard
cp deploy/ecs.env.example .env
chmod 600 .env
nano .env
```

生产 `.env` 示例（凭证替换为应用实际值）：

```dotenv
DATA_MODE=live
CHECKIN_MODE=mock
FEISHU_APP_ID=cli_your_app_id
FEISHU_APP_SECRET=your_server_only_secret
FEISHU_BASE_URL=https://girtrobotlab.feishu.cn/base/IPtmbKzAlalpS1sHv4Wc5YvhnHg?from=from_copylink
DEADLINE_MODE=date
PORT=3001
```

通常不需要 table ID：后端从链接解析 Base，读取真实表结构，按任务名称、负责人、状态等字段识别任务表。多个匹配表时需要 `FEISHU_TASKS_TABLE_ID` 消歧；多个成员表同理使用 `FEISHU_MEMBERS_TABLE_ID`。未找到成员表时，可从人员字段的负责人提取成员，此时无任务的人无法被统计，页面会明确提示。

打卡默认 `CHECKIN_MODE=mock`，根据真实成员ID生成稳定虚拟打卡，**不访问飞书打卡表**。日期内刷新不随机改变，页面标明虚拟数据。

## 4. 启动与验证

```sh
sudo docker compose up -d --build
sudo docker compose ps
curl -f http://127.0.0.1/healthz
curl -f http://127.0.0.1/api/dashboard
sudo docker compose logs --tail=100 dashboard nginx
```

`healthz` 成功表示服务启动；真实接入必须另检查 `/api/dashboard` 返回的 `source` 为 `feishu`、`checkInSource` 为 `mock`，并核对任务。飞书配置或权限错误会返回502，不回退为虚构的真实任务。

阿里云安全组放行所需访问来源的80端口；SSH 22端口仅允许管理来源。3001为容器内部端口，不对公网发布。访问 `http://ECS公网IP/` 即为4K自动滚动大屏；电脑交互版在 `/?view=desktop`。

正式使用域名时，在阿里云负载均衡/HTTPS网关终止TLS，或为Nginx配置已申请的证书与443端口；当前提供的配置仅为HTTP入口，不声称已配置HTTPS。内部成员数据应结合安全组来源限制或网关认证。若在HTTPS入口后使用应用Basic认证，同时设置 `DASHBOARD_USERNAME` 和 `DASHBOARD_PASSWORD`，大屏启动时在浏览器登录一次。

## 5. 更新与换链接

上传新源码后：

```sh
sudo docker compose up -d --build
```

只修改 `.env` 中的 Base 链接或凭证后：

```sh
sudo docker compose up -d --force-recreate dashboard
```

同一应用有读取权限、字段可识别的 Base，可以只替换 `FEISHU_BASE_URL`。URL本身不会赋予新表格读取权限。字段完全不同的表仍需要补充映射；识别失败不会靠猜测填充任务。

## 6. 82英寸显示端

显示电脑设置3840×2160，浏览器100%缩放，F11全屏或kiosk启动。1920×1080同样保持五组一行。各组成员区域超出时每4秒向上切换一人、动画600ms、首尾无缝循环，悬停只暂停当前组，人数少时静止；后台暂停且返回后重新计时。卡片固定高度，最多3条未完成任务和超出数量，已完成只保留数字。右侧预警继续自动滚动。
