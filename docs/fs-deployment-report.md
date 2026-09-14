> 2026-09-14 日报更新：标题改为【GIRT 今日任务日报】，每天北京时间00:30发送前一日统计；已打卡仅人数，未打卡列姓名，缺截止日期仅去重负责人姓名。任务状态使用发送时快照。发送日志日期/防重键仍按实际发送日；REPORT_START_AT用于首次切换避免当晚补发。下文22:00相关内容为旧版本部署记录。详见 [当前日报规则](./girt-report-update.md)。

# fs 实际部署报告 · 2026-09-14

访问地址：http://47.93.156.196/ 。在现有项目上增量修改，保留飞书接口、五组成员轮播、任务统计、虚拟打卡标识、北京时间及 RM DAILY。

## 验证结果

- ECS：i-2ze2nztd89veev4lhef3，cn-beijing，Ubuntu 24.04.4 LTS。
- 版本目录：/opt/fs/releases/fs-20260914-daily-report-r4；Node v24.21.0 独立安装于 /opt/fs/runtime。
- 公网首页及 API 成功；真实飞书快照为 9 名成员、24 项任务、12 项未填截止日期、0 项逾期、1 项即将到期。这些数字会随飞书数据和时间变化。
- 1920×1080、3840×2160 均无页面溢出，无浏览器脚本错误；成员卡片和告警区域自动展示。
- 日报于北京时间 18:28:09 发送成功，用户已确认企业总群收到且内容正常；重复请求返回 skipped，attempts 仍为 1。
- REPORT_ENABLED=true，REPORT_SEND_TIME=22:00，Asia/Shanghai。今日测试已占用当天额度，因此今晚不会重复发送；后续每日22:00执行。
- fs 服务已设置开机启动；实际完成服务重启验证，调度和发送记录持久化。未重启整台 ECS，不能将此描述为整机重启实测。
- 本地单元/接口测试29项、浏览器测试8项通过，生产构建通过；补充生产包启动检查，防止 node:sqlite 前缀被构建工具移除。
- 保留 /etc/nginx/sites-enabled/default 和原默认页面；新增独立 fs.conf，没有更改防火墙、安全组或其他服务。

## 代码修改（1—10）

| 问题 | 实现与文件 |
|---|---|
| 1—2 修改文件及职责 | 见下方完整文件表 |
| 3 日报生成 | server/reports/generate.ts：每次从现有 getDashboard 读取真实数据，输出总览、五组、重点任务、逾期、48小时内到期、未填日期及总结 |
| 4 飞书发送 | server/reports/webhook.ts：服务端Webhook、可选签名、消息字节限制、超时及明确失败/不确定投递分类 |
| 5 定时任务 | server/reports/scheduler.ts：后台递归定时检查，与浏览器无关；服务启动检查当天是否需要补发 |
| 6 修改时间 | /opt/fs/shared/.env 中 REPORT_SEND_TIME=22:00，然后重启 fs |
| 7 缺截止日期 | src/utils/task-health.ts：空日期独立分类，不误算逾期或即将到期；前后端共用 |
| 8 页面告警 | src/components/MissingDeadlinePanel.vue，插入 WallDashboard 的逾期与即将到期之间 |
| 9 手动接口 | POST /api/admin/reports/send；server/reports/routes.ts；需要 Bearer 管理令牌，管理页为 /?view=admin |
| 10 防重复 | server/reports/store.ts：SQLite 日期主键、事务抢占、状态机与尝试编号；成功跨重启保留，同日手动和自动共用额度 |

| 文件 | 修改内容 |
|---|---|
| server/reports/generate.ts | 真实任务日报正文及各类统计；虚拟考勤显著标注；限制单条消息大小 |
| server/reports/webhook.ts | 飞书机器人HTTPS发送、签名、错误脱敏 |
| server/reports/store.ts | 仅存发送状态和审计日志，不另建任务数据源 |
| server/reports/service.ts | 串联实时读取、生成、抢占、发送和日志 |
| server/reports/scheduler.ts | 北京时间调度、有限重试、启动恢复和停止清理 |
| server/reports/routes.ts | status、preview、history、send 四个鉴权接口 |
| server/app.ts | 挂载日报管理员接口，保留原 dashboard API |
| server/index.ts | 启动后端调度、HOST 配置、退出清理 |
| src/utils/task-health.ts | 统一截止状态判断 |
| src/utils/dashboard.ts | 派生未填日期集合，统一逾期/即将到期统计 |
| src/components/TaskLine.vue | 缺日期和无效日期的橙色提示 |
| src/components/MissingDeadlinePanel.vue | 固定高度的缺日期任务告警、负责人和组别、自动滚动 |
| src/views/WallDashboard.vue、src/wall.css | 右侧四个告警区域与样式布局 |
| src/views/ReportAdminView.vue、src/App.vue | 管理页预览、发送和日志；令牌仅在内存中 |
| tsup.config.ts | Node22构建目标，保留 node: 内置模块前缀 |
| scripts/smoke-production.mjs | 直接启动编译后服务的生产冒烟验证，不发送日报 |
| tests/report.test.ts、tests/report-api.test.ts | 统计边界、签名、鉴权、并发防重、重试、恢复、调度 |
| tests/browser/report.spec.ts | 告警分区、固定页面及管理员页面操作验证 |
| package.json、package-lock.json | Node最低版本22.13，新增生产启动验证命令 |
| .env.example、deploy/ecs.env.example、deploy/fs.env.example | 日报/运行环境配置模板，均不包含真实密钥 |
| .gitignore、.dockerignore | 排除环境文件及日报数据库 |
| Dockerfile、compose.yaml | 保留原Docker方案，添加容器数据卷与容器HOST；本次实际使用systemd |
| deploy/fs.service、deploy/fs.nginx.conf | 独立systemd与Nginx生产配置 |
| deploy/inspect-ecs.sh、deploy/install-release.sh | 只读检查与独立版本发布、fs配置备份/失败回滚 |
| README.md、docs/daily-reports.md、docs/ecs-ubuntu.md、本文件 | 功能说明、维护和实际部署结果 |

此前五组改动继续复用：src/config/groups.ts 统一加入运营组和操作手组；normalizeTaskCategory 将其他/其他任务映射为联调任务；人员组别不使用联调任务。src/components/MemberCarousel.vue 实现每组独立4秒轮播和hover暂停；src/components/WallMemberCard.vue 仅保留已完成数量，当前任务最多3条和剩余项数。

## 服务器维护（11—24）

| 问题 | 配置/命令 |
|---|---|
| 11 最终目录 | /opt/fs；current指向上述版本目录；shared保存环境变量，data保存日报日志数据库 |
| 12 前端 | Vite生产静态文件由Nginx直接提供，根目录 /opt/fs/current/dist |
| 13 后端 | /opt/fs/runtime/bin/node /opt/fs/current/dist-server/index.js，由systemd管理 |
| 14 服务名 | fs.service；文件 /etc/systemd/system/fs.service |
| 15 监听端口 | 127.0.0.1:18081；公网只访问Nginx的80端口 |
| 16 Nginx配置 | /etc/nginx/conf.d/fs.conf，server_name 47.93.156.196，/api反向代理到后端 |
| 17 重启 | sudo systemctl restart fs |
| 18 状态 | systemctl status fs --no-pager；systemctl is-enabled fs；curl http://127.0.0.1:18081/healthz |
| 19 后端日志 | sudo journalctl -u fs -n 100 --no-pager；持续跟踪用 -f |
| 20 日报日志 | 管理员 history 接口或日志中的 daily_report；数据库 /opt/fs/data/reports.sqlite |
| 21 环境变量 | sudo nano /opt/fs/shared/.env，保存后 sudo systemctl restart fs；不要写到源码或前端 |
| 22 日报时间 | 修改 REPORT_SEND_TIME，格式HH:mm，始终按北京时间；REPORT_ENABLED控制启停 |
| 23 开机自启 | fs与Nginx均enabled；服务重启已验证，未执行整机重启 |
| 24 发布新版 | 见以下步骤；共享环境文件、运行时和数据库保留 |

重新部署在本地完成 npm ci、npm test、npm run test:ui、npm run build、npm run test:production。归档当前源码、package.json/package-lock.json、dist、dist-server和deploy；排除.env、data、.tools、node_modules和真实数据截图。每次使用新的唯一版本名称。

通过Workbench上传归档到 /opt/fs/incoming/<版本>.tar.gz，再在ECS执行：

```sh
# 将 <版本> 替换为本次唯一版本，例如 fs-20260915-01
cd /opt/fs/incoming
tar -xOf <版本>.tar.gz deploy/install-release.sh > install-<版本>.sh
bash install-<版本>.sh <版本>
```

发布脚本安装该版本生产依赖、切换current、重启fs、检验健康检查和Nginx。失败只恢复fs自己的配置，备份位于 /opt/fs/backups/<版本>。首次发布失败会停止fs并清理自身配置，不会替换原默认站点。

管理员页面令牌来自 ADMIN_REPORT_TOKEN。当前公网为HTTP，令牌管理操作使用服务器本机接口，或配置HTTPS后使用管理页；本次发送和预览均通过Workbench在ECS本机执行。以下命令不会在终端输出令牌，可将末尾history替换为status或preview：

```sh
sudo /opt/fs/runtime/bin/node --env-file=/opt/fs/shared/.env --input-type=module -e 'const r=await fetch("http://127.0.0.1:18081/api/admin/reports/history",{headers:{Authorization:"Bearer "+process.env.ADMIN_REPORT_TOKEN}});console.log(await r.text())'
```

## 飞书配置（25—27）

25. 不需要新建另一张任务表。现有任务字段可继续读取；空截止日期需要负责人补填。兼容截止日期/截止时间/计划完成时间/计划完成日期/预计完成日期；完成日期/完成时间/实际完成日期用于准确统计今日完成。若缺少实际完成日期字段，建议增加日期字段；已完成但未填日期的记录只计入累计完成，不推测是哪天完成。人员组别增加运营组、操作手组选项并正确归组即可自动计入统计。仅靠任务推导成员时，没有任务的人不会自动出现；完整花名册需提供成员表并配置现有成员表入口。

26. 企业总群机器人Webhook已配置并实际发送成功，用户已确认收到。若以后开启签名校验，补填 FEISHU_BOT_SECRET；关键词限制需允许RoboMaster。机器人不需要数据库读权限，数据仍由原飞书应用读取。

27. 当前运行所需飞书凭据、Base链接、任务表ID、Webhook、管理员令牌和日报时间均已配置；未启用签名时Secret为空。打卡仍为用户要求的虚拟数据。真实考勤或HTTPS域名属于后续配置，当前不伪造。

详细错误状态和维护说明见 daily-reports.md。网络超时可能已投递时标为unknown并停止同日重发，优先避免群内重复消息；应先人工核对群消息。
