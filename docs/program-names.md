# 项目简称展示约定

2026-10-26 核对当前 35 所学校、177 个项目及其 60 份上传资料。

`public/program-abbreviations.js` 保存已核对的原文简称，按学校和实际专业匹配。`public/program-short-names.js` 保存四字中文名及展示用英文缩写；`public/program-presentation.js` 统一生成项目标题、矩阵表头和适用范围名称。

- 项目总览：并列显示“简称＋全称”。名称未缩短时只显示一次；共用简称的项目用各自全称区分。
- 学历资格表、成绩、材料适用范围、轮次、比较等：独立项目保留简称或紧凑中文名；共用简称包含多个专业时，省去重复前缀，直接显示简短专业名。申请类型等必要区别继续保留。
- 有原文简称时优先使用原文简称。没有时，优先用不超过四个汉字的中文名，如法律政治、生科技术、信息系统、全球政经。
- 中文不能清楚压缩时，可按已存英文专业名称形成展示缩写。EBS 是本次用户指定的环境与生物资源科学简称；EECE、ICGL、JACS、AE-EEIE 等同样是展示约定，不能反向改写招生原文或声称是官方简称。
- 新资料的英文缩写只取专业本身，排除学院、学位及连接词。没有可靠英文名称时保留原名，不能机械截字或编造英文翻译。当前全部 177 个项目的主名称均已满足四个以内汉字或英文简称。

这是一层展示映射，不是新的项目或招生规则数据库。原始 `id`、`code`、`name`、`englishName`、`channel`、招生规则、版本、来源及匹配快照不改写。专业全称在总览直接显示；完整原始中英文名称继续保留在悬停提示、详情中的“原始名称与招生方式”及编辑字段。搜索同时支持短名、全称和旧编号。

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

总览中 TAISI 的中文展开依据[早稻田官方项目说明](https://www.waseda.jp/fsss/sss/en/about/cjsp/?lng=en)所列 Transnational and Interdisciplinary Studies in Social Innovation；PEARL 的展开依据上传手册第 1 页 Program in Economics for Alliances, Research, and Leadership。中文为展示译名，不回写原始资料。

## 同名项目和历史兼容

- SPSF、IUPS 总览保留共用简称及完整专业名；下方表格只显示新闻、经济、物理、化学等专业名，单独项目详情中的表格也采用相同规则。
- GIGA 总览保留简称，下方分别显示“综合政策”“环境信息”，两个项目及其招生要求保持独立。
- FEDPE 沿用用户指定的展示简称，总览展示 FEDPE 及完整专业名；下方表格显示“初等教育”“心理教育”。不声称该简称已获原文证明。
- 不同共用简称的专业短名相同时，再补回简称区分；CSCE、FLA、EBS 等独立项目简称不受影响。
- 名古屋大学化学的理学院／工学院分别显示“化学（理）”“化学（工）”；社会科学的法学院／经济学院分别显示“社科（法）”“社科（经）”。单项目结果也保持此区别，完整学院名称在总览和原名中保留。
- 学院、申请／编入年级、英／日或选拔类别仍按需要区分。列表已有申请类型列时不重复附加；单独详情及跨项目选择中保留必要区别。
- 待核对、已入库、学生项目选择、匹配结果和历史项目快照继续使用完整项目标题；要求表格、比较、轮次和材料适用范围使用专业短名。两者共用同一套名称映射，原始编辑内容和历史记录不迁移。
- 不根据简称相似推断招生资格，也不将学校简称、学位名称或考试名称误当作专业简称。

## 验证

231 项测试通过。逐校检查 35 所学校、177 个项目及全部 80 个年度／申请类型组合（46 个非空组）：总览短名与全称、资格表短名、无重复列名、原始项目身份、四字中文名、简称／全称／英文／旧编号搜索。早稻田、京都先端科学、创价、东洋、名古屋的 1440、768、390 像素页面检查无文字越界；详情原名、项目比较仍正常。

补查 FEDPE、SPSF、IUPS、GIGA 的总览与下方表格名称，覆盖材料弹窗中的项目筛选、适用范围展开、全部要求、抽屉详情、直接访问项目详情及项目比较。共用前缀已省去，同专业不同项目的必要区别仍保留。测试不写入业务资料。
