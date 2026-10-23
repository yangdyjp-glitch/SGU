# SGU 项目工作约定

## 修改与线上发布

用户于 2026-10-23 明确要求：之后所有修改都同步本地与 Railway 线上版本，每次修改完成后直接部署线上。这是持续授权，常规提交、推送和部署不再重复征求确认。

- 在当前项目内修改，先检查分支和未提交内容，保留其他已有工作。
- 完成与改动相关的测试和界面检查，再提交并推送 `origin/main`。
- 推送后检查该提交对应的 Railway 部署结果；如果没有自动触发，使用已有授权连接对下列现有服务发布。
- 部署成功后检查线上首页、登录状态接口，以及本次改动涉及的页面或功能。只有确认新提交已部署且线上检查通过，才能报告发布完成；仅推送成功不算完成部署。
- 无法访问部署状态或发布失败时，明确报告已完成步骤、实际阻碍与线上状态，不得把未验证的部署说成成功。
- 保留学生档案、匹配记录、上传资料、人工招生规则及历史版本。不能用本地数据库覆盖线上数据库，不在更新流程执行学生清理工具；需要迁移时保留现有数据并验证兼容性。
- 密钥、`.env`、`.data/`、`.qa/`、解析缓存及服务锁不进入 Git 或部署包。

### 已确认的发布目标

- 本地目录：`D:\AI-Yang.cn\SGU`
- Git 仓库：`https://github.com/yangdyjp-glitch/SGU.git`
- 发布分支：`main`
- 线上地址：`https://sgu.up.railway.app/`
- Railway 项目：`2073f9bd-61a9-4747-9a42-f699b7515508`
- Railway 服务：`f0f56b11-feeb-451d-884f-d77332871d96`
- Railway 环境：`4910fa33-69cf-4977-a041-10378d0093a4`
- GitHub 中的部署状态名称：`appealing-joy - SGU`
- 控制台：`https://railway.com/project/2073f9bd-61a9-4747-9a42-f699b7515508/service/f0f56b11-feeb-451d-884f-d77332871d96?environmentId=4910fa33-69cf-4977-a041-10378d0093a4`

功能背景和数据约束见 `HANDOFF.md` 第 0、0A 节及 `docs/architecture.md`。历史记录中的“未部署公网”已经失效。

<!-- fastctx:begin -->
## Local file inspection

For reading, searching, and finding local files, prefer the FastCtx MCP
tools — `mcp__fastctx__read`, `mcp__fastctx__grep`, `mcp__fastctx__glob` —
over `cat`/`Get-Content`, `rg`/`findstr`/`Select-String`, and `dir`/`ls -R`.
Read only what the task needs. When you need several files, pass them to
one read call as files=[{"path": ...}, ...] instead of one call per file.
Pass absolute paths. The last line of every result says `Complete` or
`Partial` — continue only with the exact parameters a `Partial` note
provides.

### Batch replacement

Use `mcp__fastctx__replace` for mechanical find-and-replace across files.
It preserves each file's encoding and line endings, supports dry-run previews,
and rejects concurrent changes before writing. Use apply_patch for generated
content, semantic rewrites, or small local edits.
<!-- fastctx:end -->
