> 2026-09-14 日报更新：标题改为【GIRT 今日任务日报】，每天北京时间00:30发送前一日统计；已打卡仅人数，未打卡列姓名，缺截止日期仅去重负责人姓名。任务状态使用发送时快照。发送日志日期/防重键仍按实际发送日；REPORT_START_AT用于首次切换避免当晚补发。下文22:00相关内容为旧版本部署记录。详见 [当前日报规则](./girt-report-update.md)。

# 每日任务日报与截止日期告警

日报从现有 getDashboard() 读取飞书实时数据，不建立另一套任务数据库。SQLite 只保存发送状态和审计事件，不保存任务副本。打卡沿用 CHECKIN_MODE；当前 mock 模式在日报中显著标注虚拟数据。

## 状态与统计口径

- src/utils/task-health.ts 是共享截止状态入口。未完成且空日期属于 missing_deadline；严格不计入 overdue 或 upcoming。完成、已放弃任务不进入这些告警。无效日期单独判定。
- 逾期为 now > deadline；48小时内且未逾期为即将到期，恰好截止时刻仍属于即将到期。
- 日报任务完成率是截至发送时累计已完成 / 未放弃任务数；今日完成单独按实际完成日期计算，没有实际完成日期的已完成任务不猜测为今天完成。
- 多负责人任务在基地总计中去重；组内去重，跨组任务可分别出现在各组。缺负责人或状态的任务继续在待补充信息中显示，并提示未计入统计。
- 消息按UTF-8大小限制在单条Webhook消息范围内，详细名单过长时保留总数并标注另有N项，避免拆分后重复发送。

## 配置

生产环境文件：/opt/fs/shared/.env。本地开发文件：项目根目录 .env。两者均不提交到Git。

```dotenv
FEISHU_WEBHOOK_URL=
FEISHU_BOT_SECRET=
ADMIN_REPORT_TOKEN=
REPORT_ENABLED=false
REPORT_SEND_TIME=22:00
REPORT_DB_PATH=/opt/fs/data/reports.sqlite
```

在企业总群添加飞书自定义机器人，将Webhook填写到 FEISHU_WEBHOOK_URL。开启签名校验时填写 FEISHU_BOT_SECRET；若机器人限制关键词，应允许日报标题中的 RoboMaster。ADMIN_REPORT_TOKEN 至少32字符，部署时自动生成，不在前端构建中保存。配置完成后设置 REPORT_ENABLED=true 并重启 fs。

REPORT_SEND_TIME 使用北京时间 HH:mm。服务器每30秒检查一次，当天22:00后若尚未发送则执行；服务在22:00后启动时也会检查补发当天日报，不补发之前日期。停用浏览器不影响后端调度。

## 管理员功能

管理页：/?view=admin。输入管理员令牌后先预览，再点击立即发送今日任务日报。令牌只存在当前页面内存，不存入localStorage或URL。当前IP入口为HTTP时，应通过服务器本机接口管理，或先配置HTTPS后使用管理页。

接口均要求 Authorization: Bearer <ADMIN_REPORT_TOKEN>：

| 接口 | 用途 |
|---|---|
| GET /api/admin/reports/status | 调度时间、启用状态和Webhook是否配置 |
| GET /api/admin/reports/preview | 读取真实数据生成预览，不发送 |
| GET /api/admin/reports/history | 最近100条发送状态事件 |
| POST /api/admin/reports/send | 手动发送，同样受每日防重保护 |

## 防重复与故障处理

SQLite reports 表以北京时间日期为主键；BEGIN IMMEDIATE 事务抢占发送权，记录 attempts 作为尝试编号。手动和自动调用共用同一数据库。成功记录跨进程、跨重启保留，当天再次调用只返回 skipped。手动测试成功也占用当天额度，22:00不会重复发送。

- generating：正在读取数据、生成日报。超过10分钟的遗留记录可安全转为 failed；旧尝试不能夺回新尝试的发送权。
- sending：准备或正在进行Webhook请求。
- sent：已收到Webhook成功返回。
- failed：确定失败（如缺少配置、飞书明确拒绝）。自动发送间隔至少10分钟、每日最多尝试3次；管理员可主动重试。
- unknown：超时、连接异常或发送阶段中断，可能已经投递。系统不会自动重发，也不会允许同日手动盲目重发，需先人工核对群消息。

Webhook没有幂等键，无法同时保证网络超时后绝不重复和自动补发；本项目优先防止重复。unknown 默认保留至管理员核对，下一天不受影响。

发送日志保存日报日期、生成时间、发送时间、状态、错误代码、手动/自动来源及尝试编号。错误日志只含安全错误码，不输出Webhook、Secret或HTTP请求配置。

## 运行和维护

```sh
sudo systemctl restart fs
systemctl status fs --no-pager
systemctl is-enabled fs
sudo journalctl -u fs -n 100 --no-pager
sudo journalctl -u fs -f
sudo nano /opt/fs/shared/.env
```

日志中的 daily_report 是发送结果，daily_report_scheduler 是调度启停信息。详细事件可通过管理员 history 接口查询；数据库位于 /opt/fs/data/reports.sqlite，发布新代码不会替换它。

重新部署：本地 npm ci、npm test、npm run build；将新版本源码和 dist/dist-server 打包上传到 /opt/fs/incoming/<版本>.tar.gz，再执行该版本的 deploy/install-release.sh <版本>。环境变量、数据库和Node运行时均位于版本目录之外。

## 参考

- [飞书自定义机器人官方说明](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
- [Node 内置 SQLite](https://nodejs.org/api/sqlite.html)
- [Workbench 官方使用说明](https://www.alibabacloud.com/help/zh/ecs/user-guide/connect-to-an-instance-through-workbench-cli/)
