# 课程成绩与奖学金要求

2026-10-26 对当前 35 所学校、177 个有效项目开展专项核对。依据各项目已上传招生简章，并补查学校官方网站。不同入学年份、申请／编入项目分别保存；官网没有标明适用年份的建议成绩会明确注明核对日期，以当年简章为准。

## 页面与数据

学校及单项目的“学历资格与身份”下新增“课程成绩与奖学金”。申请要求、奖学金要求并列，科目和适用条件可展开查看。相同条件在学校页合并，并标明适用项目；学校、年份及申请／编入切换使用原有筛选范围。

复用原有 `academicTests` 和项目版本存储，没有新增平行资格库或数据库表：

- `scoreDetails`：课程类型、考试年份等细分范围、申请状态及要求、奖学金状态及要求、科目条件、原文依据。
- `scholarshipGrades`：一般 GPA、排名及续领奖学金的条件；明确区分“入学申请”与“入学后／续领”。
- `scoreReview`：专项核对日期与范围。历史记录缺少上述字段时仍可读取和回档，页面显示尚未专项整理，不推定无门槛。

申请状态区分硬性最低要求、明确不设最低分、资料未列最低分、建议／历史参考、个别录取条件和不能替代必交考试。奖学金分数达到门槛不等于获得奖学金。完整 A-Level 与 AS、UK／International／Singapore A-Level、OSSD 与其他加拿大文凭、IB 42 分与 45 分口径均保留差异。

后续文档整理按相同结构提取。原始要求仍保留在 `requirements` 等已有字段；明确硬性条件按原流程录入规则，建议成绩和奖学金门槛不作为入学淘汰条件。本次对已有项目补充成绩说明，不改变已有资格匹配逻辑。

## 典型核对结果及依据

- [立教 PEACE 2027 招生简章](https://www.rikkyo.ac.jp/admissions/undergraduate/guidelines/mknpps000001yiyx-att/mknpps000001zh6g.pdf)：IB 申请 28／45、RPFS 奖学金 35／45；HKDSE 按考试年份拆分；Singapore A-Level 与 UK／International 分开。保留科目、英语替代、所在地及最终成绩规定。
- [东北大学 Gateway College](https://admissions.tohoku.ac.jp/en/admissions/undergraduate/gateway_college/)：IB 等分数标为建议成绩；人文社科与 STEM 科目条件分别保留。
- [名古屋 G30 项目页](https://admissions.g30.nagoya-u.ac.jp/undergraduate/)：仅对明确公布的项目增加 Recommended Scores，不作为硬性最低分，也不套用到其他专业。[G30 奖学金](https://admissions.g30.nagoya-u.ac.jp/studentlife/scholarships/)为综合评审，不推造课程分数线。
- [ICU 招生 FAQ](https://www.icu.ac.jp/en/admissions/undergraduate/faq/)：明确不设学术考试最低分与仍须满足完整资格、科目组合分别展示。
- [关西学院 2027 材料清单](https://www.kwansei.ac.jp/en/assets/List_of_Application_Documents2027.pdf)：补入 IB、GCE、Singapore A-Level、HKDSE 等材料类型和组合要求；没有分数线的项目如实标明。

其他具体数值、科目及奖学金阶段均链接至项目自身简章页码。网页补充资料保留官方链接，完整原始招生规则不被覆盖。

## 验证与发布

- 自动测试覆盖两列成绩保存／重读、版本回档、历史匹配不变、考试年份、科目和奖学金差异不被错误合并、来源转义及旧文档兼容。
- 对 177 个项目校验新增内容外所有原字段不变，原有匹配结果不变；来源不跨项目误用。
- 浏览器检查 35 所学校的 80 个年份／申请类型组合，涵盖 177 个项目；检查桌面和窄屏布局、详情弹窗、单项目侧栏及无写入的页面切换。
- 生产更新通过现有版本化保存接口，以原版本号检测并发修改；逐项目记录依据，保留全部旧版本。原文件、学生档案和历史匹配记录不变。

资料未列分数不代表没有门槛；不将其他学校、其他年份或研究生奖学金标准移植到当前本科项目。需要学校个别决定的最终成绩保留为个别条件。
