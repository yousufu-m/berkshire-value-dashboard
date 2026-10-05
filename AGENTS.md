# Codex 维护说明

## 范围与结构

这是纯 HTML/CSS/JavaScript 的长期投资研究看板。优先保持简单，不为小功能引入前端框架、后端、登录或新依赖。先阅读 README.md 与 CHANGELOG.md，检查 `git status`，保留用户现有改动。

- 页面、样式、初始研究数据、交互逻辑分别在 `docs/index.html`、`docs/assets/styles.css`、`docs/assets/companies.js`、`docs/assets/app.js`。
- `docs/` 为发布目录，同时也是源码；资源地址使用相对路径，兼容 GitHub Pages 的项目子路径。
- `companies.js` 必须先于 `app.js` 加载。两者使用顺序执行的经典 defer 脚本。
- app.js 的 DOM 初始化有 document 环境检查，便于 Node VM 对模型函数做无浏览器测试。

## 数据纪律

- 初始行情、估值倍数、研究叙事和主观分数都未逐项核验。不能仅因修改代码而标记 verified。
- 新事实必须有可追溯来源与数据时点。事实、假设和意见分开；保留 Bear Case 与逻辑失效条件。
- OE、市场资本额与股权范围必须一致，外币换算方向不可颠倒；缺少资料时不得输出确定性买入信号。
- 缺失值必须与 0 区分。金融计算的边界错误应清空旧输出。
- 修改估值方法时写清口径、单位、模型限制和回归用例。

## 持久化与安全

- 主存储键是 `xw_dashboard_v2`。旧键为 `xw_weights`、`xw_penalties`、`xw_vals`、`xw_reviews`。
- 保留 v1/v2 JSON 导入兼容性。改存储格式时必须设计迁移并测试；不要静默清除用户记录。
- 浏览器保存不是云同步。新网页网址不会自动读取附件版或其他设备的数据。
- 用户输入和导入文本必须转义；来源链接只允许 http/https。保留导入校验、数量限制及确认替换步骤。
- 不提交密钥、账户授权、个人数据备份、个人复盘或持仓。本项目不需要 API Key。
- 不把 GitHub Token、行情 API Key 写进前端；如未来接 API，先讨论服务端和权限方案。

## 检查与交付

每次改动运行：

```sh
npm test
npm run check
```

UI 改动再用 `npm run dev` 在浏览器验证相关功能、窄屏布局和键盘操作。明确区分桌面窄屏模拟与真实 iOS Safari/App 测试；未测试的环境必须说明。涉及保存逻辑时检查刷新恢复与导出/导入。

保持改动范围，更新 CHANGELOG.md。功能性改动默认使用分支和 PR。发布分支由 GitHub Pages 设置决定，建议 main + /docs；向该分支推送可能更新线上网站。没有本次会话的明确授权，不要新建公开仓库、改变可见性、启用公开发布、合并 PR 或向线上分支推送。用户已明确授权的操作不必反复确认。
