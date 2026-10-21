# SGU 选校网站开发交接

更新日期：2026-10-21（北京时间）  
用途：在另一台电脑、另一段 Codex 会话中接续修改现有项目。

## 0. 最新有效状态：先读本节

**网站已经完成学校层级总览、统一资格矩阵和紧凑轮次更新。接续时修改现有代码；用户 Windows 本机仍须执行一次更新脚本以清空学生并加载新版。**

| 项目 | 当前状态 |
| --- | --- |
| 仓库 | https://github.com/yangdyjp-glitch/SGU.git |
| 主分支 | `main` |
| 本轮开始时的基线 | `7e2b3d69768e04fa6632a08746fe9926db5f35d3`（PowerShell BOM修复） |
| 当前功能 | 学校总览与学生清理更新；本文件与功能代码一同提交，接续时拉取最新 `main` |
| 当前电脑代码目录 | `C:\Users\Administrator\Documents\ChatGPT\SGUREAD\sgu` |
| 默认本地地址 | http://127.0.0.1:3210/ |
| 技术栈 | Node.js 24.15+、原生 HTTP、原生 SQLite、浏览器 ES 模块和 CSS |
| 初始招生范围 | 立命馆大学 2027 AO 英语本科：GLA、JDP、GS、CRPS、ISSE |
| 已收录数据 | 23 页手册、135 条来源分析记录、28 条语言考试／版本门槛、11 组申请轮次 |
| 验证状态 | 本轮 Linux / Node 24.19：49项自动测试、语法／资源／脚本BOM检查及主要DOM交互检查通过；新版真实浏览器布局、Windows脚本待实机确认 |
| 部署状态 | 原 Windows 本地服务由用户运行；本轮无法直接访问该电脑或数据库。源码更新不等于本机已清理或部署；未部署公网服务 |

### 需求优先级与旧文档的含义

1. 用户在当前会话中的最新明确要求。
2. 本文件中的最新状态及已确认修改要求。
3. [原始需求交接](docs/requirements-handoff.md)第 0、0A 节中的业务规则和逻辑架构。
4. 原始交接的第 1—9 节，仅供历史追溯。

原始交接保留了当时的“先不要制作网页”“技术栈未确定”“尚未创建代码”等记录。用户后来已明确要求开始开发、上传上述 Git 仓库，并连续提出账号和界面修改。这些旧的阶段描述已经失效；不能据此把项目退回需求讨论阶段或重新搭建另一套网站。

交接文件创建后，用户继续排查 Windows 本地启动与登录自启动问题。`npm.cmd start` 已由用户确认可用；后台启动发现 Windows PowerShell 读取无 BOM 的中文脚本时出现乱码和字符串终止符解析错误。当前修复为 `start.ps1`、`stop.ps1` 保存 UTF-8 BOM，并通过 `.editorconfig` 保持编码；不改业务逻辑或数据库。用户电脑上的修复后启动与重新登录自启仍须实际验证。

## 0A. 用户最新确认的界面与账号要求

**整体界面简洁、信息密度尽可能高；路径要求与成绩要求不能遗漏。** 通过表格、归并重复内容和收紧留白实现紧凑展示，关键资格与分数条件直接显示。

| 主题 | 已确认要求及当前实现 |
| --- | --- |
| 员工登录 | 只需要账号和密码，不要求姓名；首个账号为管理员。这里指员工账户，学生档案仍保留学生姓名字段 |
| 当前管理员 | 原电脑已创建账号 `admin`；真实密码不写入源码或本交接，数据库只保存密码哈希 |
| 原文链接 | 在“原文与版本”设置“显示详细原文链接”开关，刷新页面默认关闭；开启后显示各条详细来源。完整 PDF 入口一直保留 |
| 学生档案 | 清空全部已有学生及匹配记录；不再自动生成测试档案。已提供备份后执行一次的维护脚本，实际 Windows 数据须本机执行后才清空 |
| 学校与项目层级 | 首屏只列学校入口；学校总览列项目入口，并归并学历、语言、材料、轮次和后续要求，明确适用项目；特殊条件单独展示 |
| 资格展示 | 统一“学制／资格 × 项目”可否矩阵，逐项列十二年课程、MEXT、WASC、NEASC、Cognia、COBIS、CIS、ACSI、IB、A-Level等；不再以A/B/C路径数组织详情 |
| 资格目录扩展 | 使用所有已核对项目当前规则中的资格／认证和新增布尔资格项扩充目录；另一学校引入的新项也显示在原学校矩阵中 |
| OSSD／DSE | 当前立命馆显示“否（手册未列明）”。该显示口径不自动否决持有人通过十二年课程等通用路径申请；实际匹配逻辑保留 |
| 申请轮次布局 | 每个项目轮次一行；入学节点、申请期间、初筛、面试、最终结果各自成列，条件性结果说明用ⓘ保留 |
| 路径 B | 必须完整显示 **`(WASC, NEASC, Cognia, COBIS, CIS or ACSI)`**，不能缩写成“指定认证机构” |
| 默认人群 | 中国籍学生或具有日本国籍的华裔。隐藏与该人群无关的国籍专属信息；中国／日本学生在其他国家或教育体系就读的有效路径仍须保留 |
| 资格组合 | 删除没有信息量的“资格组合”说明块。保留真正的“多项目并申／跨轮申请”规则，两者不同 |
| 资格取得节点 | 合并到“申请轮次”，显示对应入学节点，不在学历区重复列截止点 |
| 个别审查 | 不另设泛化的咨询期限大栏；具有实际约束的特殊要求跟随适用路径显示。目前路径 I 保留申请期开始前 3 周联系的要求 |
| 英语教育豁免 | 条件和证明范围集中于语言区，只显示一次；六年英语教育不能在学历、语言和材料区重复铺陈 |
| 申请材料 | 主页面只列材料名称与说明标识。鼠标停留、键盘聚焦可查看提示；点击／手机触摸可打开完整说明 |
| 筛选方式 | 放到申请轮次区域，与初筛、面试、结果日期一起查看 |
| 后续阶段要求 | 仅有实际内容时显示栏目及导航。GLA、JDP、GS有相关内容；CRPS、ISSE目前没有，不显示空栏 |
| 成绩展示 | 保留总分、指定科目、单项、量表、考试日期分界、有效期、豁免和不接受的形式；区分“未注明”和“不适用” |

展示精简不等于删除底层资格规则。默认人群之外的已有规则仍保存在判定引擎中。学校总览只覆盖已收录项目、所选年度与通道，不凭空计算录取概率。共同条件只有内容与门槛完全相同时才合并；总分、单项、版本或适用条件不同会拆行。

## 1. 在新电脑恢复开发

新电脑安装 Git 和 Node.js **24.15 或以上**。本项目没有第三方运行依赖，也没有前端构建步骤；普通查看与修改不需要先安装 MinerU。

首次取得源码：

```powershell
git clone https://github.com/yangdyjp-glitch/SGU.git
cd SGU
node --version
npm.cmd run check
npm.cmd test
npm.cmd start
```

浏览器打开 http://127.0.0.1:3210/ 。`npm.cmd start` 在当前终端运行，停止时使用 Ctrl+C。Windows 使用 `npm.cmd` 可避开 `npm.ps1` 的执行策略报错；其他系统仍使用 `npm`。

如果新电脑已有本仓库，先确认并保留自己的未提交修改，再更新：

```powershell
git status --short --branch
git pull --ff-only origin main
```

Windows 后台启动，在项目目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

确认网站可访问后可关闭终端。停止时运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\stop.ps1`，只停止该脚本记录的 SGU 进程。执行策略参数只对该 PowerShell 进程生效。`start.ps1` 按默认 3210 端口工作；修改端口后优先用终端启动并访问实际端口。

### 本轮更新与清空学生（只需执行一次）

在用户当前 Windows 项目目录执行：

```powershell
cd "C:\Users\Administrator\Documents\ChatGPT\SGUREAD\sgu"
git pull --ff-only --autostash origin main
if ($LASTEXITCODE -eq 0) {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apply-school-update.ps1
}
```

脚本依次：停止该启动脚本登记的 SGU 进程；确认默认端口没有仍运行的服务；以 `VACUUM INTO` 备份完整数据库（包含已提交WAL）；事务清空全部students、matches及student/match类别操作记录；写入一次性标记；重新后台启动并检查HTTP。账号、会话、招生规则、历史版本、上传资料和 `.env` 保留。

备份路径会输出到终端，默认是 `.data/backups/before-student-clear-*.db`。清理标记为 `student-reset-school-overview-20261021`；重复执行跳过清理，之后新建学生不被删除。**普通 `start.ps1` / `npm.cmd start` 不清空数据。** 新工作空间只初始化招生规则，学生数为0。

若旧服务在前台 `npm.cmd start` 终端运行，先用 Ctrl+C 停止；脚本不会任意结束其他Node进程。自定义端口部署先按原方式停服，在项目目录运行 `npm.cmd run students:clear`（读取 `.env` 和 `DATA_DIR`），然后按原方式启动。本轮执行环境无法访问用户 Windows，因此不得声称真实学生已清空；须核对本机脚本成功输出和页面学生数为0。

### Windows PowerShell 编码故障（2026-10-21）

用户报告 `start.ps1:15` 中文变为乱码，并出现“字符串缺少终止符”，脚本在解析阶段失败，尚未执行 Node 启动。因此 Node 错误日志可能为空。原脚本为 UTF-8 无 BOM；当时两份启动／停止 `.ps1` 已补上 UTF-8 BOM；本轮新增更新脚本也使用该编码，脚本文本和启动逻辑保持原样。`.editorconfig` 对 `*.ps1` 指定 `charset = utf-8-bom`，后续编辑须保留。

验证范围：已核对修复后的文件字节为 `EF BB BF` 开头，去掉 BOM 后与原脚本完全一致。当前修复环境为 Linux，不能据此声称已经验证 Windows PowerShell 5.1 启动；需在用户 Windows 上运行脚本、关闭启动终端后访问网页，并验证下次登录自动启动。

### 登录 Windows 后自动后台启动

用户此前已经在当前 Windows 账号的启动文件夹创建 `SGU.lnk`。快捷方式调用 `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<项目目录>\start.ps1"`，工作目录指向项目目录。上述编码错误会使该隐藏进程退出；修复脚本后可复用该快捷方式。快捷方式创建成功不等于服务已经启动成功。

新电脑或新的 Windows 账号需重新配置。先确认手动后台启动成功，再在 PowerShell 中一次性执行以下命令；`$sguRoot` 改为实际项目路径：

```powershell
$sguRoot = 'C:\Users\Administrator\Documents\ChatGPT\SGUREAD\sgu'
$sguScript = Join-Path $sguRoot 'start.ps1'
if (-not (Test-Path -LiteralPath $sguScript)) { throw 'SGU start.ps1 not found.' }
$sguLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'SGU.lnk'
$sguShortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($sguLink)
$sguShortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$sguShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $sguScript + '"'
$sguShortcut.WorkingDirectory = $sguRoot
$sguShortcut.Save()
Start-Process -FilePath $sguLink
```

这只配置当前用户登录后的启动，不是 Windows 系统服务；不提供异常退出后自动重启，也不保证关机或休眠期间可访问。取消时用 Win+R 打开 `shell:startup`，删除 `SGU.lnk`。发生错误时，去掉 `-WindowStyle Hidden` 在可见终端运行同一脚本，记录实际错误并查看 `.data/server-error.log`，不要仅凭快捷方式执行无报错判断服务健康。

`.env` 是可选的，缺少时可以直接运行。需要个性化配置时，以 `.env.example` 为模板，按新电脑实际路径和服务地址填写。

## 2. 换电脑时，代码与数据分别处理

### 只继续修改代码／样式

克隆仓库即可，首次运行会建立新电脑自己的数据库和初始招生规则。首次打开网页创建首个管理员，只填写账号和密码。

**原电脑的 `admin` 账户不会随 Git 克隆出现。** 要保留原账号及原工作空间，需迁移数据库。

### 需要保留原账号、学生和人工修改的规则

| 内容 | 是否随 Git 同步 | 迁移方式 |
| --- | --- | --- |
| 源码、初始招生数据、词库、原始 PDF、测试、文档 | 是 | 拉取最新 `main` |
| `.data/sgu.db` | 否 | 包含账号、学生、当前规则、版本、匹配历史和操作记录；随完整数据目录迁移 |
| `.data/uploads/` | 否 | 原始上传文件与提取结果；与数据库一起迁移 |
| `.env` | 否 | 按新电脑的实际路径重建；外部模型密钥单独配置 |
| MinerU 可执行文件、模型、缓存和服务 | 否 | 新电脑单独安装／配置；不会因克隆本仓库而自动安装 |
| `.qa/` | 否 | 测试与临时检查文件，不作为业务数据迁移 |

迁移工作空间的顺序：

1. 确认旧电脑和新电脑的 SGU 服务都已停止。
2. 备份新电脑已有数据，防止覆盖另一个工作空间。
3. 将原电脑项目中的**完整 `.data` 目录**通过自己的文件传输方式复制到新电脑项目目录。不要在服务运行时只复制 `sgu.db` 而遗漏可能存在的 SQLite WAL 文件；上传目录也须一起保留。
4. 如果使用自定义 `DATA_DIR`，迁移的是该变量指向的实际数据目录；默认才是项目下的 `.data`。
5. 调整新电脑 `.env` 中的本机路径，启动后确认账号、项目版本、学生和上传文件可正常读取。启动脚本会生成新电脑的进程记录，旧 PID 不适用于新电脑。

“团队设置”的 JSON 导出不包含密码和登录会话，不是完整的账号恢复包；本项目也没有宣称实现一键导入该 JSON 的完整恢复流程。

Git 提交和推送不会带走 `.data`，也不会把正在运行的数据库自动更新为新的 seed。不要为了同步初始规则而删除用户数据库。多人同时协作应连接同一台服务，两台电脑分别启动的本地数据库不会自动互通。

## 3. 代码与资料地图

| 文件 | 修改什么时优先阅读 |
| --- | --- |
| [public/school-detail.js](public/school-detail.js) | 学校聚合、年度／通道隔离、共同要求与项目适用范围 |
| [public/qualification-matrix.js](public/qualification-matrix.js) | 通用资格目录、规则映射、可否矩阵及完整附加条件 |
| [public/requirement-model.js](public/requirement-model.js) | 共用展示模型：完整资格说明、豁免归并、材料细则与特殊条款 |
| [public/rounds-table.js](public/rounds-table.js) | 学校和项目复用的紧凑轮次表 |
| [public/project-detail.js](public/project-detail.js) | 项目详情及材料悬停／完整说明弹窗 |
| [public/school.css](public/school.css) | 学校总览、资格矩阵和紧凑轮次样式；在compact.css之后加载 |
| [apply-school-update.ps1](apply-school-update.ps1) | Windows停服、备份清理、后台重启入口（UTF-8 BOM） |
| [lib/student-reset.mjs](lib/student-reset.mjs) | 一次性清空、完整备份、事务与重复执行保护 |
| [scripts/clear-students.mjs](scripts/clear-students.mjs) | 显式调用的学生清理CLI；不在普通启动时触发 |
| [public/compact.css](public/compact.css) | 最新紧凑布局、详细来源显示开关样式、提示框、手机布局；在基础样式后加载 |
| [public/app.js](public/app.js) | 前端主路由、登录、学生与匹配、问答、项目列表、编辑器、弹窗及事件处理 |
| [public/styles.css](public/styles.css) | 基础设计变量、组件、表单和原始响应式布局 |
| [public/index.html](public/index.html) | 页面入口，加载样式与 ES 模块 |
| [server.mjs](server.mjs) | HTTP 服务、静态资源、登录会话、API、请求校验 |
| [lib/store.mjs](lib/store.mjs) | SQLite、账号密码哈希、事务、数据持久化和初始化 |
| [lib/engine.mjs](lib/engine.mjs) | 条件判定、学历路径、语言成绩、窗口、材料及组合申请规则 |
| [lib/seed.mjs](lib/seed.mjs) | 根据来源数据建立首期项目规则；已有数据库不会因修改 seed 自动被覆盖 |
| [lib/query.mjs](lib/query.mjs) | 本地自然语言条件解析与项目检索 |
| [lib/llm.mjs](lib/llm.mjs) | 可选的 OpenAI 兼容语义模型接口 |
| [lib/ingest.mjs](lib/ingest.mjs) | 本机 MinerU 调用、文本提取、关键词建议 |
| [data/admissions-source.json](data/admissions-source.json) | 当前手册的结构化来源记录，包括项目、要求、成绩、日程 |
| [data/keywords.txt](data/keywords.txt) | 本科申请关键词库，含 F021—F025 |
| [public/sources/aohb27.pdf](public/sources/aohb27.pdf) | 已收录的完整 23 页招生手册，原文证据入口 |
| [docs/requirements-handoff.md](docs/requirements-handoff.md) | 原始需求与12项逻辑规则；优先读第0、0A节，阶段描述按本文件更新 |
| [docs/architecture.md](docs/architecture.md) | 数据对象、运算规则、版本与实现取舍 |
| [docs/verification.md](docs/verification.md) | 实测记录、截图和尚未执行的外部环境验证 |
| [tests/engine.test.mjs](tests/engine.test.mjs) | 核心判定逻辑回归 |
| [tests/api.test.mjs](tests/api.test.mjs) | 账号、协作、版本、冲突、上传及历史 API 回归 |
| [tests/project-detail.test.mjs](tests/project-detail.test.mjs) | 防止详情精简时丢路径、门槛、证明或特殊条件 |
| [tests/school-detail.test.mjs](tests/school-detail.test.mjs) | 资格拆分／动态扩展、28条门槛聚合、11轮日期完整性、学校导航与年度隔离 |
| [tests/student-reset.test.mjs](tests/student-reset.test.mjs) | 清理备份、账号及规则保留、重复执行保护 |
| [tests/fixtures/students.mjs](tests/fixtures/students.mjs) | 仅自动测试使用的虚构学生；不再从正式seed导出 |

原始资料工作目录为 `D:\AI-Yang.cn\analysis\aohb27\outputs\aohb27_review\`。这是旧电脑的资料来源，不是新电脑运行网站的前提；网页所需 PDF、词库和结构化来源已经在仓库内。原 Excel 分析表、原生成脚本以及整个 MinerU 安装目录并不随本仓库完整迁移。

## 4. 已确认业务逻辑：修改时继续遵守

1. **共用规则**：学生匹配、条件问答和项目浏览使用同一份当前项目规则。AI负责理解输入与解释，资格结论由结构化规则计算。
2. **范围绑定**：要求绑定学校、项目、招生通道、年度／入学期及轮次。新年度应新建规则记录，不覆盖旧年度事实。
3. **路径择一**：完整满足一条学历路径即可；项目通用硬性要求还须同时满足。年龄限制跟随所属路径。
4. **考试按次记录**：考试版本、日期、总分和单项属于同一次考试，不自行跨次取最高分。目标分数只用于明确标注的模拟。
5. **阶段分开**：申请时、录取后、入学前、入学后条件不得混用；后续要求不能误作当前申请门槛。
6. **未知有独立含义**：学生未填写、学校未注明、明确不要求、明确不接受分开处理；未知不自动判为通过或失败。
7. **资格与待办分开**：资格、申请窗口、材料准备、学费与专业偏好分别展示；没写文书或缺可选奖项不能直接判定资格不符。
8. **组合另查**：单项目通过后，再检查并申、跨轮重申及材料复用；分别合格不代表能同时申请。
9. **歧义需澄清**：“只有托福”要区分英语证明种类与是否另需学术考试。只能回答已收录范围，不能推及整所学校或所有日本项目。
10. **保存立即生效**：所有员工可编辑规则；不增加管理员审批或保存后再发布流程。管理员是账号角色，不是规则审批关卡。
11. **版本与冲突**：保存产生新版本与审计；并发版本不符返回409并展示差异。回档产生新当前版本，保留中间版本。
12. **历史不可变**：匹配历史绑定当时学生快照与规则版本，重跑产生新结果，不静默改写旧结果。

字段扩展沿用原业务范围：F021年龄、F022国籍及签证、F023多项目／多轮规则、F024学费、F025其他证明材料。忽略的主题见原始交接；不要把原始135条来源记录全部变成新的独立功能。

## 5. 最容易在精简中丢失的招生细节

以下是接续开发的重点检查项，完整事实仍以来源 JSON、当前规则及 PDF 为准。

- 路径 B 的六个认证机构必须完整呈现：`(WASC, NEASC, Cognia, COBIS, CIS or ACSI)`。
- 路径 D 的完整资格清单、E 的 MEXT 指定11年课程范围、F 的日本大学预备教育、I 的具体认定及特殊审查要求均须保留。不能仅凭学生国籍推断课程符合条件。
- 18岁限制仅适用 G／H／I；不要加到 A 等其他路径。JDP排除F、H，以及指定的“専修学校の高等課程”毕业资格，不能扩大为排除所有职业教育。
- TOEFL 以考试日 **2026-01-21** 区分0–120与1–6量表；不能直接混用。成绩有效期以所选申请轮次截止日向前2年计算，且在申请期间可取得成绩。
- GLA总分与已列出的四项单项必须同时满足；PTE communicative skills、Cambridge各技能要求也不能丢。GLA只接受所列C1 Advanced，不接受B2 First和C2 Proficiency。
- JDP的 **SAT EBRW 610** 与 **ACT English 25** 是指定单项门槛，不是SAT总分或ACT综合分。不接受ACT Superscore。
- 保留TOEFL Home Edition／Essentials／MyBest、IELTS Online／One Skill Retake及机构考试等不接受的形式。
- GLA全英语IB要求教学与考核均为英语，有非英语语言技能课程例外；在读者最终未取得Diploma会撤销录取，相关材料与IBO直送要求保留。
- JDP四年教育豁免须保留Grade 9–12、英语为唯一教学语言、无ESL、课程／教育体系的替代关系和完整指定国家地区范围。中国／日本国籍不排除其适用这些教育路径。
- GS／CRPS／ISSE的最近6年全英语教育参照点是**入学日**；证明原则上覆盖期间每所学校，除非最后一所可以证明此前学校的授课语言。条件与证明集中显示一次。
- 中国高中毕业证明／CSSD、JDP全部高中成绩及日文成绩也须译成英语、文书字数与标题要求、成绩直送代码和截止阶段均保留在材料说明中。
- 学术SAT／ACT可选与JDP的英语单项证明是不同用途；不接受SAT Subject Tests。未注明高中GPA或统一学术总分门槛，不等于不审查学业成绩。
- GLA后续GPA、GS入学后TOEFL ITP 520及JDP赴AU前财力证明按阶段显示；不要转成当前申请最低条件。旧年度财力参考金额不能充当2027学费。

## 6. MinerU、模型与新电脑配置

当前已有数据足以运行匹配与浏览；只有继续解析新资料时才需要准备解析环境。

原电脑已验证本机 MinerU 4.0.12 标准解析，完整提取23页手册，得到82854字符并形成100条待核对关键词定位建议。站点调用本地标准解析，不使用 `--remote`；PDF提取失败时保留原文件并提示重试。自动提取结果须由员工核对后保存，不能自动成为正式规则。

旧电脑配置示例，仅供定位，**新电脑须改为自己的实际路径**：

```dotenv
MINERU_BIN=D:/AI-Yang.cn/tools/mineru/uv-tools/mineru/Scripts/mineru.exe
MINERU_HOME=D:/AI-Yang.cn/tools/mineru/data
MINERU_MODEL_BASE_DIR=D:/AI-Yang.cn/tools/mineru/models
MINERU_BIN_DIR=D:/AI-Yang.cn/tools/mineru/bin
```

如继续沿用该安装方式，先使用原安装目录的 `mineru.cmd server start` 启动解析服务。不要停止其他项目共用的MinerU进程。旧电脑曾遇到MinerU直接写网站目录的权限问题；现适配器读取结构化标准输出，由网站负责保存，已验证可用。

问答默认是本地条件解析，尚未配置外部通用语言模型。可通过 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 接入兼容接口；三项配置齐全才启用，密钥不提交Git。MinerU视觉模型不是通用问答模型。

## 7. 验证与接续边界

本轮验证（Linux / Node 24.19.0）：

- `npm test`：49项通过；原逻辑与详情回归、新资格矩阵、学校聚合和一次性清理均覆盖。
- `npm run check`：语法、初始规则、必要资源及全部PowerShell脚本BOM通过。
- 独立DOM交互检查：空学生列表、学校列表→学校→项目、年度切换、11轮显示、OSSD搜索、原文开关、材料弹窗和新增档案的资格选项通过。DOM检查工具仅装在隔离的 `.qa/`，未新增运行依赖。
- 浏览器无法访问开发容器服务，本地文件预览又被浏览器安全策略阻止；未绕过该限制。新版桌面／手机真实布局和Windows更新脚本尚待本机确认。

以下为**上轮旧版界面**的历史验证，截图不代表本轮学校总览：

- `npm run check`：JavaScript语法、五项目seed规则及必要资源检查通过。
- `npm test`：41项通过，包括21项引擎测试、API工作流及11项子测试、8项详情完整性测试。
- 浏览器验证：五项目均可打开；GLA／JDP／GS／CRPS／ISSE分别有5／10／4／4／5条语言门槛。CRPS、ISSE无空后续栏。
- 原文链接默认隐藏；CRPS开启后显示62个详细来源按钮；关闭后隐藏。完整PDF入口一直可用。
- 材料提示支持停留、键盘与点击，手机可打开完整说明；390×844和1280px桌面布局没有页面横向溢出，宽表在自身容器内滚动。
- 截图见 [项目总览](docs/screenshots/compact-project.png)、[成绩及材料](docs/screenshots/compact-scores.png)、[手机](docs/screenshots/compact-mobile.png)。

已知实现边界：未部署公网；Docker构建与外部HTTPS反向代理未验收；外部语言模型未联调。自然语言解析有明确支持范围，不声称能处理所有自由问法。新增项目或来源条款时，需要同步检查判定、详情归并、材料提示和证据是否覆盖，尤其 `requirement-model.js` 中的条目编号与项目专属处理。资格目录可从结构化规则扩展，不代表任意新PDF可自动核对并发布。

原Windows启动／停止脚本本轮未改逻辑。新增更新脚本已核对BOM与调用路径；清理逻辑在SQLite测试中通过，Windows PowerShell 5.1实际执行与登录自动启动仍需本机确认。

## 8. 接续修改的工作方法

1. 先读本文件第0、0A节，再读所需代码与 `docs/architecture.md`。涉及业务逻辑时补读原始交接第0A节。
2. 确认当前目录、分支与未提交修改；保留用户在新电脑已有的工作。不要因旧绝对路径不存在而另建一套实现。
3. 学校总览优先读 `school-detail.js`、资格矩阵 `qualification-matrix.js`、共用模型 `requirement-model.js`、轮次 `rounds-table.js` 与 `school.css`；路由和其他页面修改 `app.js`，同时考虑基础与compact样式覆盖。
4. 涉及条件、门槛、版本或数据结构时检查引擎和对应回归测试。修改seed不会自动迁移现有数据库；需要数据变更时制定保留人工修改的迁移。
5. 用真实浏览器查看改动后的页面。当前原生前端没有热更新，改代码后需要刷新；先确认新代码已经加载，再判断效果。
6. 修改代码后做与变更相关的验证；主要回归命令是 `npm run check` 和 `npm test`。不需要为纯文案或可逆样式调整机械新增测试。
7. 按用户此前要求，将完成的修改提交并同步到同一Git仓库，说明变化和验证结果。禁止把真实数据库、密码、密钥或上传的私有资料加入仓库。

当前电脑曾遇到Git CLI凭据存储导致推送失败，已通过GitHub连接器完成同步，再核对远端与本地文件树一致。这是本机凭据环境问题；新电脑若常规 `git push` 正常，直接使用即可。不要把旧电脑的临时凭据处理当成项目运行依赖。

## 9. 可直接粘贴给新电脑 Codex 的提示

> 这是继续开发现有 SGU 选校网站的任务。请先阅读仓库根目录 HANDOFF.md 的第0、0A、1、2、3节，以及 docs/architecture.md；业务细节参考 docs/requirements-handoff.md 第0、0A节。旧交接中的“尚未开始制作网站”是历史记录，现已完成开发并同步GitHub。仓库为 https://github.com/yangdyjp-glitch/SGU.git，分支main。请先检查当前代码与未提交修改，基于现有实现继续，保留已确认的业务逻辑。界面须简洁、高信息密度，但路径要求和成绩要求不能遗漏，路径B必须完整显示 (WASC, NEASC, Cognia, COBIS, CIS or ACSI)。学校列表先进入学校，再进入项目；共同要求标明适用项目，资格用统一可否矩阵（OSSD/DSE未列明显示否但不自动否决其他路径）。轮次一行、初筛／面试／结果分列。详细原文链接默认关闭，材料细则通过提示查看，重复内容集中展示。正式初始化不生成测试学生；本轮已提供一次性备份清空更新脚本，未执行前不得声称Windows学生已清空。账号、学生及人工规则在本机.data中，不随Git迁移。读完后按我接下来的具体修改要求执行，不自行新增功能或重置数据。
