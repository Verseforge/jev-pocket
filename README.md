# Jev Pocket

一个面向个人用户的移动端 Jev 判断工具，无需接触 JSON 即可完成是非、多选和程度评分。

它把 TypeSafe / Jev 的结构化接口包装成普通中文界面：粘贴内容、写下问题、选择判断方式，然后直接查看人话结果。页面针对安卓手机设计，并支持添加到主屏幕。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVerseforge%2Fjev-pocket)

## 功能

- 是／否判断、多选一、程度评分
- 不展示请求 JSON 或技术字段
- TypeSafe API Key 只保存在当前设备的浏览器中
- 服务端中转 TypeSafe 请求，避开浏览器 CORS 限制
- 中文错误提示、置信度进度条
- PWA，可添加到安卓主屏幕

## 部署结构

```text
安卓手机上的 Jev Pocket
        ↓
Vercel Serverless Function 中转
        ↓
TypeSafe API
```

GitHub 负责保存源码和版本；Vercel 负责运行 Node.js 中转并提供可以直接打开的网址。GitHub Pages 只能托管静态文件，无法单独运行本项目的中转接口。

## 从 GitHub 部署到 Vercel（推荐）

1. 注册并登录 [Vercel](https://vercel.com/)。建议直接选择 **Continue with GitHub**。
2. 在 Vercel 首页选择 **Add New… → Project**。
3. 在 **Import Git Repository** 中找到这个仓库，选择 **Import**。
4. **Framework Preset** 保持自动识别即可；不要填写 Build Command、Output Directory或环境变量。
5. 选择 **Deploy**，等待部署完成。
6. 打开 Vercel 给出的 `https://……vercel.app` 地址。
7. 在 Jev Pocket 设置中粘贴自己的 TypeSafe API Key。
8. 安卓 Chrome 右上角菜单选择 **添加到主屏幕** 或 **安装应用**。

以后只要更新 GitHub 仓库，Vercel 会自动重新部署，无需重复配置。

## API Key 安全说明

- 不要把真实 Key 写进源码、README、`.env` 或 Vercel 环境变量。
- Key 默认只保存在当前浏览器的 `localStorage`，发起判断时经由自己的 Vercel 中转传给 TypeSafe。
- 本项目不会主动记录 Key，也不会把 API 请求加入离线缓存。
- 仍建议把部署网址仅用于个人使用，不要在不信任的公共设备上保存 Key。

## 本地运行（可选）

需要 Node.js 20 或更高版本：

```bash
npm install
npm start
```

然后打开 <http://localhost:4173>。开发时可运行 `npm run dev`，基础语法检查可运行 `npm run check`，自动化测试可运行 `npm test`。

## 项目文件

```text
public/          手机网页和 PWA 文件
api/analyze.js   Vercel 上的独立 API 路由
lib/analyze.js   TypeSafe 请求与响应处理
server.js        本地开发用 Express 服务
tests/           API 与错误展示自动化测试
vercel.json      Vercel 部署配置
package.json     Node.js 启动脚本与依赖
```

## 常见问题

### 为什么不能只用 GitHub Pages？

GitHub Pages 只能提供 HTML、CSS、JavaScript 等静态文件，不能运行 `/api/analyze` 这个 Node.js 中转。没有中转时，浏览器会遇到 CORS 限制，也不适合处理 API Key。

### Vercel 需要填写 TypeSafe API Key 吗？

不需要。部署完成后，在手机网页右上角的设置中填写即可。

### 页面显示 HTTP 404 或“接口没有部署成功”怎么办？

先在 Vercel 的 **Deployments** 页面确认最新一次部署状态为 **Ready**，再直接打开 `https://你的域名/api/analyze`。正常情况下会看到一段包含“这里只接受 POST 请求”的 JSON；如果仍是 Vercel 的 `NOT_FOUND` 页面，请确认仓库中存在 `api/analyze.js`，然后在最新部署右侧菜单中选择 **Redeploy**。

### 部署后收费吗？

Vercel 和 TypeSafe 的免费额度、计费规则可能调整，请以各自官网当前说明为准。Jev Pocket 本身不会额外收费。
