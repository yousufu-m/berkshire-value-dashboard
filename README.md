# 伯克希尔式“十五五”长期价值投资看板

面向长期研究的静态网页：公司筛选、重点关注、主观评分、所有者收益估值、季度复盘与财务观察。使用中文，适配窄屏。研究方法受巴菲特与芒格理念启发，但评分体系、DCF 参数和筛选规则均为自定义模型，不是伯克希尔官方工具，也不构成投资建议。

## 当前状态

- 从原单文件 HTML v0.2 整理为可维护的 v0.2.1 项目，原文件独立保留。
- 34 家公司、8 条研究主线；继承的行情、估值倍数和评分均待核验。
- 发布文件已准备好；仓库创建与 GitHub Pages 启用须完成后才能获得可用网址。本文不表示已经上线。
- 无实时行情、登录、后台通知、服务器数据库或跨设备同步。

## 文件在哪里改

| 文件 | 用途 |
| --- | --- |
| `docs/index.html` | 六个页面、表单与提示文字 |
| `docs/assets/styles.css` | 颜色、布局、移动端样式 |
| `docs/assets/companies.js` | 初始公司池和待核验数据 |
| `docs/assets/app.js` | 交互、估值、数据校验、导入导出、本地保存 |
| `tests/model.test.cjs` | 金融计算、校验及数据迁移回归测试 |
| `scripts/check.mjs` | 语法、页面标识、资源路径检查 |
| `scripts/serve.mjs` | 本机开发预览服务 |
| `AGENTS.md` | 给 Codex 和其他代码助手的维护约定 |
| `CHANGELOG.md` | 版本变更记录 |

`docs/` 同时是可编辑源码和发布目录，没有另一个需要手工同步的构建副本。

## 本机维护

安装 Node.js 22 或更高版本。在项目文件夹打开终端：

```sh
npm test
npm run check
npm run dev
```

浏览器打开 `http://127.0.0.1:8000`。运行和测试均使用 Node 内置能力，不需要安装 npm 依赖，也不需要 API Key。网站本身运行不依赖 Node，直接由静态服务器提供 HTML/CSS/JS。

## GitHub Pages 首次发布

建议仓库名为 `berkshire-value-dashboard`。先确认仓库可见性和网页公开范围，再创建仓库并提交这些文件；不要覆盖其他项目。

1. 确保 `main` 分支已有 `docs/index.html` 及 `docs/assets/`。
2. 在仓库的 **Settings → Pages → Build and deployment** 中选择 **Deploy from a branch**。
3. 分支选择 **main**，文件夹选择 **/docs**，保存。
4. 等待 GitHub 完成构建，使用 Pages 设置页返回的实际网址。
5. 从 iPhone 的 Safari 打开网址，测试切换页面、公司详情、☆ 关注、估值、导入导出及刷新恢复。

后续修改并推送到发布分支会更新网站。GitHub 官方文档：

- [配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [创建 GitHub Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

GitHub Free 支持公开仓库上的 Pages；私有仓库的支持取决于账户方案。一般 Pages 网站即使来自私有仓库，也仍然公开；不要把仓库私有误认为网页有访问密码。网络可达性需要在实际使用的网络上测试，不能保证所有地区始终可访问。

## 手机使用与迁移

请在 Safari 中打开已发布的网页网址，不要把 App 内的附件预览当作完整网页执行环境。需要时可将网址加入书签或主屏幕；本版没有实现 PWA 离线缓存。

研究记录保存于当前浏览器的 `localStorage`。迁移到新网址、更换设备、清理浏览器数据或进行大版本升级前，在“数据管理”中导出 JSON；在目标网页中导入并确认。附件版与网页的存储位置不同，内容不会自动带过去。

不要把自己的 JSON 备份、个人复盘、持仓、Token 或其他私密资料提交到仓库。忽略规则可以减少误提交，但发布前仍要检查 Git 暂存区。

## 数据与估值边界

原 HTML 标注采集日为 2026-10-04，但没有逐项交易日期、来源链接和市值币种范围。因此全部初始行情标记为待核验；代码整理没有更新行情，更没有验证初始分数。更新公司时请记录来源、实际数据日期、PE/PB 期间、股息口径和市值覆盖的股权范围。

标准化 OE 为税后股东现金流；市值须覆盖同一股权范围，比较前须对齐币种。估值取 OE 收益率法和 DCF 中较低的模型值作折价参考，这不是实际价值的保底下限。安全边际不能保证避免永久损失；现金流下降、竞争优势削弱或增长所需资本投入上升都可能推翻原估值。需保留 Bear Case 和可观察的逻辑失效条件。

参考原文：

- [伯克希尔 1986 股东信：Owner Earnings](https://www.berkshirehathaway.com/letters/1986.html)
- [伯克希尔 1992 股东信：安全边际](https://www.berkshirehathaway.com/letters/1992.html)

## 交给 Codex 的起始指令

> 请先阅读 AGENTS.md、README.md 和 CHANGELOG.md，检查当前分支及未提交改动。我要修改的是【具体需求】。保留研究数据的待核验标识和 v1/v2 备份兼容性。完成后运行 npm test 与 npm run check，说明改动和检查结果，并在独立分支提交供我审阅。除非我明确要求发布，不要直接向线上发布分支推送。
