# RoboMaster 基地任务指挥中心

以成员为中心的深色 HUD 任务看板。Vue 3 + TypeScript + Vite + Pinia + Axios + Day.js，独立 Express 后端。原生 CSS 实现轻量进度条和面板，不引入不必要的图表或 Admin 模板。

## 本地启动

需要 Node.js **22.12 或更新版本**。

```sh
npm install
npm run dev
```

打开 http://localhost:5173 。前端 5173，API 3001，Vite 自动代理 `/api`。默认不需要 `.env`；未配置飞书时 API 自动返回演示数据，页面明确显示「演示数据 / DEMO MODE」。内置 **16 名成员、48 条任务、历史打卡数据及 40 条每日语录**，日期随当天动态生成。

### 82 英寸 4K 非触控展示屏

默认首页按 3840×2160 原生画布布局，1920×1080 与 4K 均保持五组一行。顶部统计、时钟、组标题和 RM DAILY 固定；各组成员区域独立轮播，超出时每4秒向上切换一人，动画600ms，首尾无缝循环。悬停只暂停当前组，后台暂停且返回后重新计时。人数少时静止。右侧缺卡和预警继续自动滚动；每60秒同步，断线保留旧数据并重试。

界面截图仅保留在本地，不随源码提交。默认页面为 4K 自动滚动大屏。

- 连接电脑设置输出分辨率 3840×2160；在浏览器使用 F11 全屏，或由运维通过浏览器 kiosk 模式启动。
- 推荐系统显示缩放与浏览器缩放均为100%，以获得原生尺寸：标题54px、姓名36px、任务26px、统计数字100px。
- 页面会按实际浏览器视口等比适配，包括Windows显示缩放和浏览器工具栏占用；不依赖物理英寸识别或自动触发浏览器全屏权限。
- 演示模式提供16人、48项任务；真实模式按飞书动态计算。首页卡片固定高度，只显示最多3条未完成任务，超出以 +N 项任务提示；已完成仅保留数字。
- 220V供电及杜比全景声属于显示设备参数，不改变网页尺寸；页面为静音展示。
- 原交互版保留在 `http://localhost:5173/?view=desktop`，可在电脑端使用筛选、分页和任务详情。

以下交互功能说明中的分页、筛选和弹窗对应 `?view=desktop` 入口；默认大屏版不依赖这些操作。

```sh
npm test          # 日期边界、统计规则、飞书字段清洗
npm run build    # 前后端类型检查与生产构建
npm start        # Express 同时托管 dist 和 /api/dashboard，默认3001端口
npm run test:ui  # 先在另一终端运行 npm run dev；默认使用本机 Microsoft Edge
```

没有 Edge 的环境，将 `playwright.config.ts` 中 `channel: 'msedge'` 删除，并执行 `npx playwright install chromium`。

## 功能

- 四项指标：今日未打卡、已打卡、未完成任务、逾期任务；不显示项目总进度。
- 成员卡片：个人完成率、最多三个当前未完成任务和超出数量；已完成只显示数字，桌面版点击打开完整历史列表。
- 6 人一页，全部在队成员均可翻页查看。组别筛选同步影响统计、成员、缺卡及截止提醒。
- 连续未打卡名单、按截止时间排序的逾期任务、未来 48 小时截止提醒。
- 秒级北京时间、60 秒数据刷新、最后同步时间、局部刷新、全屏。
- 请求失败保留上次数据并显示连接异常，首次失败显示重试界面，不静默切换为演示数据。
- 大屏 1920×1080、2560×1440，兼容笔记本与手机；列表独立滚动，弹窗支持 Escape、焦点约束与关闭后焦点恢复。

## 连接飞书

**当前推荐：ECS 长期应用身份 + Base链接 + 虚拟打卡。** 完整步骤见 [Ubuntu 24.04 ECS 部署指南](docs/ecs-ubuntu.md)。配置 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_BASE_URL`、`DATA_MODE=live`、`CHECKIN_MODE=mock`。后端自动读取表结构并识别唯一任务表；表名不固定，字段支持常见别名。多候选表必须用ID消歧。私有链接仍需应用的读取权限。

没有独立成员表时，可从任务人员字段提取负责人；没有任务的人无法统计，页面会提示此范围。打卡按真实成员ID生成稳定模拟数据，不请求飞书打卡记录，并明确标记虚拟考勤。提供的真实链接已解析，但当前真实字段读取仍等待用户授权，不能声称已经完成租户联调。

下面是兼容的显式三表配置说明。**只有 `CHECKIN_MODE=live` 才启用真实打卡表并要求三个 table ID。**

1. 复制 `.env.example` 为 `.env`，填写下面六项。切勿将真实 `.env` 提交到 Git。
2. 在飞书开放平台创建企业自建应用，启用多维表格读取权限，例如 `bitable:app:readonly`；发布应用版本，并由管理员批准相应权限。
3. 将应用添加为目标多维表格的可访问应用，授予只读权限；启用高级权限的 Base 也需要允许应用读取三张表及其记录。
4. 在同一个 Base 中配置下述三张表，将 URL 中 `/base/` 后的 token 和各 `table=tbl...` 填入环境变量。Wiki 链接先打开实际 Base，不要把 Wiki token 当作 Base token。
5. 重启 `npm run dev`，页面应显示「飞书已连接」。

```dotenv
FEISHU_APP_ID=cli_your_app_id
FEISHU_APP_SECRET=your_server_only_secret
FEISHU_BASE_TOKEN=your_base_token
FEISHU_MEMBERS_TABLE_ID=tbl_members
FEISHU_TASKS_TABLE_ID=tbl_tasks
FEISHU_CHECKINS_TABLE_ID=tbl_checkins
DATA_MODE=auto
DEADLINE_MODE=date
```

本项目未附带真实飞书凭证。上述值仅为格式示意，必须替换为实际值。App Secret 与访问令牌只在服务端使用，不出现在客户端配置、HTTP 响应或错误日志中。**任何 `VITE_` 变量都会进入前端，请只填写公开配置。**

`DATA_MODE=auto` 在所有连接变量为空时使用 mock；提供链接/凭证后，缺少必要配置会报错。`DATA_MODE=live` 强制真实连接，`mock` 强制演示。`CHECKIN_MODE` 默认 `mock`，独立控制打卡数据源。连接失败绝不伪装成真实数据。

## 多维表格字段

字段名需与下面中文名称一致。项目只读现有表，不创建、覆盖或修改飞书文档及记录。修改字段映射请编辑 `server/normalize.ts`。

### 成员表

| 字段 | 飞书字段类型 | 说明 |
| --- | --- | --- |
| 成员ID | 文本 | 建议必填且唯一，如 RM-001；为空时使用记录 ID |
| 姓名 | 文本 | 必填，支持富文本 |
| 组别 | 单选 | 机械组 / 电控组 / 视觉组 / 运营组 / 操作手组；未知值待分组并保留统计 |
| 状态 | 单选 | 可选业务描述，不替代是否在队 |
| 加入时间 | 日期 | 必填，连续未打卡的统计起点 |
| 是否在队 | 复选框 | 必填，仅勾选的成员纳入统计 |
| 头像 | 附件 | 可选；当前 UI 使用姓名与组别占位头像，不读取私有附件 |

### 任务表

| 字段 | 飞书字段类型 | 说明 |
| --- | --- | --- |
| 任务ID | 文本 | 可选，为空使用记录 ID |
| 任务名称 | 文本 | 必填 |
| 负责人 | **关联成员表** | 必填，推荐单向或双向关联，支持多人；也支持唯一成员ID或唯一姓名文本 |
| 所属组别 | 单选 | 机械组 / 电控组 / 视觉组 / 运营组 / 操作手组 |
| 开始日期 | 日期 | 可选 |
| 截止日期 | 日期 | 推荐填写；缺失时显示提示，任务仍计入未完成但不计入截止提醒 |
| 任务状态 | 单选 | 必填：未开始 / 进行中 / 待验收 / 已完成 / 已逾期 |
| 任务优先级 | 单选 | 高 / 中 / 低（兼容紧急、P0/P1/P2）；未填按低 |
| 任务进度 | 数字 | 0–100，可选；个人完成率始终按任务完成数量计算 |
| 任务描述 | 文本 | 可选，展示在详情中 |
| 完成日期 | 日期 | 推荐填写，用于最近完成排序；缺失排在最后 |

负责人建议使用**关联字段**，不要直接使用飞书「人员」字段，因为人员 open_id 不等于成员表的成员ID。无法关联、重名文本关联、重复成员ID或未知状态会导致显式数据错误，避免静默漏计。

### 每日打卡表

| 字段 | 飞书字段类型 | 说明 |
| --- | --- | --- |
| 日期 | 日期 | 必填，按北京时间转为 YYYY-MM-DD |
| 成员 | **关联成员表** | 必填，解析规则与任务负责人一致 |
| 组别 | 单选 | 可选，展示按成员表组别为准 |
| 是否打卡 | 复选框 | 必填，仅勾选是有效打卡 |
| 打卡时间 | 日期（包含时间） | 可选，打卡归属日按「日期」字段 |
| 今日完成 | 文本 | 可选，留存于飞书 |
| 遇到的问题 | 文本 | 可选，留存于飞书 |
| 明日计划 | 文本 | 可选，留存于飞书 |

## 统计约定

- 所有日历日期、时钟与每日语录统一使用 **Asia/Shanghai**，与浏览器和服务器系统时区无关。
- 默认 `DEADLINE_MODE=date`：截止为北京时间该日 23:59:59.999，下一天才逾期。`datetime` 则保留飞书字段的精确时间；这样解决原需求中「日期比较」与「当前时间比较」两种口径的差异。
- 逾期 = 未完成且截止时间早于现在；已完成任务永不逾期。「已逾期」可作为原始状态显示，但逾期统计仍严格根据实际截止时间判断。
- 即将截止 = 未完成，截止时间在现在至未来 48 小时内，含边界。
- 成员完成率 = 已完成任务数 ÷ 未放弃的任务数；零任务显示「暂无任务」。当前任务优先级从高到低，同优先级按最近截止排序。
- 同日重复有效打卡只算一次；无效打卡不撤销当日已有的有效记录。未来加入和离队成员不计入。
- **连续未打卡需要历史记录**：真实数据读取打卡表所有分页，从加入日期起计算日历日（包含周末和今天），遇到有效打卡停止。请保留完整打卡历史；如果历史记录曾被删除，连续缺卡结果无法还原。
- 演示历史只有最近八天，历史不足时显示 `8+ DAYS`，不将下限伪装成准确值。
- 多负责人任务在各成员卡中分别出现，在组别范围内的任务总计只算一次；分组以负责人所在组为准。无在队负责人的任务不计入当前基地统计。
- 目前采用全分页读取保证计数完整，并合并同一实例上的并发请求。超大型历史表可能超出 Serverless 时间限制，此时应使用 Linux 常驻后端，或扩展增量同步及存储；不会返回半页成功数据。

## API

`GET /api/dashboard` 返回清洗后的 `DashboardData`：

```ts
{
  members: Member[],
  tasks: Task[],
  checkIns: CheckIn[],
  source: 'mock' | 'feishu',
  syncedAt: string,
  historyStart: string,
  warnings: string[]
}
```

前端共享工具 `src/utils/dashboard.ts` 从完整数据生成 summary、members、overdue、upcoming 等展示视图，确保手动筛选与秒级截止判定同步。错误返回 HTTP 502 及 `DATA_CONNECTION_LOST`。令牌按有效期提前 120 秒刷新，限流重试有上限；分页异常使整个读取失败。HTTP 响应使用 `Cache-Control: no-store`。

## 部署

### Vercel

导入 Git 仓库，设置 Build Command 为 `npm run build`、Output Directory 为 `dist`，Node.js 22 或更新版本。仓库内 `api/dashboard.ts` 提供 Serverless API，`vercel.json` 配置函数最长 60 秒。将六个飞书变量和 `DATA_MODE=live` 添加到平台**运行时环境变量**，不要添加 `VITE_` 前缀。前后端同域，无需设置 API 地址。

### Netlify

导入仓库，使用已有 `netlify.toml`：构建 `npm run build`、发布 `dist`、函数目录 `netlify/functions`。`/api/dashboard` 重写到函数，使用同一数据读取层。在平台添加服务端环境变量并确保函数作用域可用。

### GitHub Pages

GitHub Pages 只能托管前端，不能运行飞书后端。

1. 将 Node 后端部署到 Vercel、Netlify 或 Linux。
2. 构建前设置 `VITE_API_BASE_URL=https://your-api.example.com`，在后端设置 `ALLOWED_ORIGIN=https://yourname.github.io`（origin 不含仓库路径）。
3. 仓库 Pages 设置选择 GitHub Actions，使用本项目 `.github/workflows/pages.yml`。
4. Actions 仓库 Variables 配置 `VITE_API_BASE_URL`；纯演示部署则明确设置 `VITE_STATIC_MOCK=true`，无需后端。

`VITE_BASE_PATH=./` 默认相对路径，兼容仓库子路径。不配置后端又未开启静态演示模式时，页面会显示连接错误，不会偷偷替换为演示数据。不要将飞书 Secret 作为前端构建参数。前端 API 地址和静态模式更改后需要重新构建。

### Linux 常驻服务

```sh
npm ci
cp .env.example .env
# 编辑 .env 填入飞书配置
npm run build
npm start
```

Express 在 3001 端口同时提供前端与接口。推荐使用 systemd/PM2 管理进程，在 Nginx 中代理到 `127.0.0.1:3001` 并配置 HTTPS。例如：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;
}
```

### 基地内部访问控制

看板涉及成员内部数据。Linux 同域部署可在 `.env` 设置 `DASHBOARD_USERNAME` 与 `DASHBOARD_PASSWORD` 启用 HTTP Basic，浏览器首次访问时输入；务必配合 HTTPS。这两个变量必须同时设置，否则服务拒绝访问。Vercel/Netlify 中该配置保护 API，静态前端本身无成员数据，可额外使用平台访问控制保护整站。

跨域前端携带凭据请求；若使用 Basic，请先直接访问 API 域名的 `/api/dashboard` 在浏览器完成认证。跨站凭据可能受浏览器限制，内部使用优先选择同域部署或机构统一认证。CORS 仅限定浏览器跨域读取，不能替代身份认证。

## 目录

```text
src/
  components/     独立 HUD 组件、成员详情、异常面板
  views/          看板布局及刷新生命周期
  stores/         Pinia 数据与筛选状态
  services/       浏览器 API 请求
  utils/          日期、统计、40条每日语录
  mock/           随当天生成的演示数据
  types/          成员、任务、打卡与视图类型
server/           Express、飞书鉴权及分页、数据清洗
api/              Vercel 入口
netlify/          Netlify 函数入口
tests/            核心逻辑与浏览器交互测试
```

字体采用带本地回退的 Google Fonts；无法访问时自动使用系统字体，不影响功能。界面不依赖远程图片资源。

## 官方接口参考

- [飞书：列出记录](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list)
- [飞书：获取企业自建应用 tenant_access_token](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal)

## 当前验证范围

本地 mock、类型检查、生产构建和自动化检查可在上述命令中复现。真实飞书访问需要实际应用凭证、表格 ID 与授权；没有凭证时无法声称已完成真实租户联调。各云平台配置已提供，部署需要用户的平台账号及仓库。


## 五组配置与联调分类

- 五个人员组统一维护在 src/config/groups.ts；支持运营／运营组、操作手／操作手组等有无后缀的标签。
- 联调任务属于任务分类，不属于人员组别。可选字段任务分类／任务类型／分类中的其他／其他任务，读取和前端展示时兼容为联调任务，不改写飞书原文。
- 没有成员表时，成员由任务负责人和执行人提取，优先按本人负责的任务推断组别；跨组协助、空白或多组任务不覆盖已明确的组别。仍无法唯一确定的人员列在待补充信息，保留人数和任务统计。
- 现有飞书表无需改字段名。新增运营、操作手人员时，在现有组别选项中选择对应标签，并填写负责人或执行人。若要求无任务成员也显示，或需要完全独立于任务的人员归组，可配置已有的成员表接入方式。
- 打卡沿用 CHECKIN_MODE=mock，始终标注虚拟数据；本次不改变飞书认证、轮询和打卡数据源。
