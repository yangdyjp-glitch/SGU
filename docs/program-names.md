# 项目简称展示约定

2026-10-25 核对当前 35 所学校、177 个项目及其 60 份上传资料。

`public/program-abbreviations.js` 保存已核对的展示别名，按学校和实际专业匹配。`public/program-presentation.js` 统一生成项目标题、矩阵表头和适用范围名称。有明确简称时直接显示简称，不再重复中文全称。来源未明确简称的项目保留简短专业名，不把自动生成的首字母串当作官方简称。

这是一层展示映射，不是新的项目或招生规则数据库。原始 `id`、`code`、`name`、`englishName`、`channel`、招生规则、版本、来源及匹配快照不改写。中英文全称可在悬停提示、详情中的“原始名称与招生方式”以及原始编辑字段中查看；学校及项目搜索同时支持简称、原名和旧编号。

## 本次补核的主要来源

页码为上传 PDF 的物理页码。使用已有提取全文核对，不重新解析或更改文件。

| 学校 | 展示简称 | 核对依据 |
| --- | --- | --- |
| 早稻田 | MS、CSCE、ME、CE | `18早稻田大学.pdf` 第 3 页 Degree Programs 的 Abbreviation 列；ME 对应 Mechanical Engineering（机械工程），不能映射为 Chemical Engineering |
| 早稻田 | TAISI、JCulP | `15早稻田大学.pdf` 第 2 页标题；`17早稻田大学.pdf` 第 1 页标题 |
| 东京国际 | DSAI、BE、DBI、IR | `54东京国际大学.pdf` 第 3 页各 Major 标题；原导入 DSA 改为展示 DSAI |
| 东洋 | GINOS、INIAD | `58东洋大学.pdf` 第 12 页 Global Innovation Studies；第 18 页 Information Networking for Innovation and Design |
| 会津 | ICTG | `44会津大学.pdf` 第 4 页 ICTG Program，及申请说明中的 ICTG AY2027 |
| 冈山 | GDP | `56冈山大学.pdf` 第 19 页 Discovery Program for Global Learners (GDP) |
| 大阪 | HUS、IUPS | `5大阪大学.pdf` 第 15 页申请系统项目名称；`6大阪大学.pdf` 第 3 页项目定义 |
| 明治 | SGJS | `31明治大学.pdf` 第 1 页 School of Global Japanese Studies (SGJS) |
| 明海 | GMM | `48明海大学.pdf` 第 3 页 Global Management Major (GMM) |
| 筑波 | BPGI | `29筑波大学.pdf` 第 2 页项目定义 hereinafter BPGI |
| 法政 | GBP、IGESS、GIS、SCOPE | `33–36法政大学.pdf` 的项目标题与招生办公室名称 |
| 立命馆亚洲太平洋 | APM、ST | `50立命馆亚太大学.pdf` 第 26 页 College of International Management (APM)、第 9 页 College of Sustainability and Tourism (ST) |
| 立命馆亚洲太平洋 | APS | [大学官方学院页面](https://en.apu.ac.jp/aps/) 的 College of Asia Pacific Studies (APS)，2026-10-25 核对 |

其他沿用的简称包括原文名称已明确的 IGS、GSEP、GIGA、GLS、GTS、GLAP、IGP、SPSF、Kyoto iUP，以及既有已核对的 SILS、FLA、PEARL、MJSP、ISP、ILA、SIS 和立命馆五个项目简称。

## 同名项目和历史兼容

- SPSF、IUPS 包含多个专业，固定显示“简称 · 简短专业”，筛选到单个项目时也保持一致。
- GIGA 的综合政策与环境信息分别保留后缀，不因共用简称而合并。
- FEDPE 沿用用户指定的展示简称，两项仍为“FEDPE · 初等教育”和“FEDPE · 心理与教育”；不声称该简称已获原文证明。
- 学院、申请／编入年级、英／日或选拔类别仍按需要区分。列表已有申请类型列时不重复附加；单独详情及跨项目选择中保留必要区别。
- 待核对、已入库、学生项目选择、比较、轮次、材料适用范围、匹配结果和历史项目快照均使用同一套展示函数。原始编辑内容和历史记录不迁移。
- 不根据简称相似推断招生资格，也不将学校简称、学位名称或考试名称误当作专业简称。

## 验证

218 项测试通过；逐校检查 35 所学校、177 个项目的 46 个非空年度／申请类型分组。早稻田四个简称、矩阵表头、详情原名、项目比较、简称／中文／英文／旧编号搜索均通过；学生选择、规则编辑、历史入口及手机页面已检查。2,087 条材料记录及项目归属保留，测试未写入业务资料。
