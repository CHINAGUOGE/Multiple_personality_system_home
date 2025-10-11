

# Claude.md

> 本仓库：`mpsteam.cn` 官网（Cloudflare Pages + Astro）。目标：与 `https://wiki.mpsteam.cn/` 统一配色与信息架构，主站负责「首页/品牌/导流」，Wiki 负责「内容/检索/长文」。

---

## 1) 工作目标（What to build）

- 建立一个基于 **Astro** 的静态官网：
  - 顶部导航：主页 / 关于我们 / 加入社区 / Wiki / GitHub / 联系方式
  - Hero 区：品牌口号 + 进入 Wiki 按钮 + 关键卖点
  - 模块：项目简介、面向人群、常见误区科普、贡献方式、友情链接
  - 页脚：备案/版权/社媒链接
- 与 `wiki.mpsteam.cn` **配色与风格一致**，从 Wiki 读取/复用主色、次色、文字与背景变量。
- **性能与首屏**：LCP ≤ 2.5s（桌面/移动），通过 Astro + 图片懒加载 + Cloudflare CDN。
- **部署**：Cloudflare Pages `production` 绑定 `mpsteam.cn`，并在导航处明显链接到 `https://wiki.mpsteam.cn/`。
- **自动化**：PR 预览、Lint、无障碍与链接检查、站点地图与 robots、基础 Analytics。

---

## 2) 关键约束（Constraints）

- 语言：简体中文为主，支持后续 i18n。
- UI：复用 Wiki 色板；**不要**引入与 Wiki 冲突的全局样式。
- 可维护：页面/组件/样式模块化，统一变量与 Token。
- 安全：仅静态输出，不引入服务端密钥；表单走外部无密钥方案或暂留占位。

---

## 3) 技术栈与工具（Stack）

- **Astro + TypeScript**
- UI：Tailwind CSS（JIT）、@fontsource 可选
- 图标：lucide（按需）
- Lint：ESLint、Prettier、markdownlint、stylelint
- QA：linkinator（或 lychee）、pa11y（可选）
- 部署：Cloudflare Pages（构建：`npm run build`，产物：`dist/`）
- 分析：Cloudflare Web Analytics（可选，无需密钥）

---

## 4) 目录结构（期望）

```
.
├─ public/                 # 静态资源（favicons、社交分享图等）
├─ src/
│  ├─ content/             # 文案片段、JSON/MD 片段
│  ├─ layouts/             # 页面布局
│  ├─ components/          # 组件（Nav/Hero/CTA/Footer/Card...）
│  ├─ pages/
│  │  ├─ index.astro       # 首页
│  │  ├─ about.astro
│  │  ├─ join.astro
│  │  └─ links.astro
│  ├─ styles/              # 全局样式与设计令牌
│  │  ├─ tokens.css
│  │  └─ theme.css
│  └─ utils/
├─ astro.config.mjs
├─ tailwind.config.ts
├─ package.json
├─ tsconfig.json
├─ .eslintrc.json
├─ .prettierrc
├─ .markdownlint.json
├─ .stylelintrc.json
├─ .gitignore
└─ README.md
```

---

## 5) 设计令牌（统一配色）

> 与 `wiki.mpsteam.cn` 保持一致。若无法直接读取 Wiki 变量，先用占位，后续一次性替换。

`src/styles/tokens.css`（示例占位，建立变量位点）：

```css
:root {
  /* Brand from Wiki —— 待对齐 */
  --brand:        #6b7cff;  /* 主色 */
  --brand-600:    #5a6ae6;
  --accent:       #ff7ab6;  /* 强调 */
  --bg:           #ffffff;
  --fg:           #0f172a;  /* 文字 */
  --muted:        #64748b;

  /* Surfaces */
  --surface:      #f8fafc;
  --card:         #ffffff;
  --border:       #e2e8f0;

  /* State */
  --ok:           #16a34a;
  --warn:         #f59e0b;
  --danger:       #ef4444;

  /* Radius & Shadow */
  --radius: 16px;
  --shadow: 0 10px 30px rgba(2,6,23,.07);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:      #0b1220;
    --fg:      #e5e7eb;
    --surface: #0f172a;
    --card:    #111827;
    --border:  #1f2937;
  }
}
```

`src/styles/theme.css`（Tailwind 基础样式桥接）：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: var(--fg);
  background: var(--bg);
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
```

---

## 6) 开发脚本（package.json 建议）

```json
{
  "name": "mpsteam-cn",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "eslint . && prettier -c . && markdownlint **/*.md && stylelint \"src/**/*.css\"",
    "lint:fix": "eslint . --fix && prettier -w . && markdownlint -f **/*.md && stylelint \"src/**/*.css\" --fix",
    "check:links": "linkinator dist --recurse --silent",
    "check:a11y": "pa11y http://localhost:4321 --reporter text",
    "postbuild": "node scripts/postbuild.js || true"
  },
  "devDependencies": {
    "astro": "^4.16.0",
    "typescript": "^5.6.3",
    "eslint": "^9.12.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.3",
    "markdownlint-cli": "^0.41.0",
    "stylelint": "^16.9.0",
    "stylelint-config-standard": "^36.0.0",
    "tailwindcss": "^3.4.13",
    "@tailwindcss/typography": "^0.5.15",
    "linkinator": "^6.1.2",
    "pa11y": "^8.0.0",
    "lucide-static": "^0.469.0"
  }
}
```

---

## 7) Cloudflare Pages 配置

- **Build command**：`npm run build`
- **Build output directory**：`dist`
- **Node 版本**：`20`
- **环境变量（可选）**：
  - `NODE_VERSION=20`
  - `TZ=Asia/Shanghai`
  - `ASTRO_TELEMETRY_DISABLED=1`
- **自定义域**：绑定 `mpsteam.cn`；`wiki.mpsteam.cn` 指向 Wiki 项目。
- **路由与缓存**：
  - 清理 404 → 返回自定义 `404.astro`
  - `/_headers` 与 `/_redirects`（如需 SPA 子路由或强制 HTTPS）

---

## 8) 首屏与 SEO

- 产出 `sitemap.xml`、`robots.txt`
- `<meta>`：标题、描述、OG/Twitter 卡片
- 图片懒加载 `loading="lazy"`；首屏图片使用 `astro <Image />`
- 组件级分割，尽量零 JS（仅交互用 islands）
- 语义标签 + a11y（`aria-*`、对比度）

---

## 9) Claude Code 协作流程

**约定分支**：`feat/*`、`fix/*`、`chore/*`、`docs/*`  
**提交格式**：Conventional Commits，例如 `feat(hero): add primary CTA`  

**常用命令**：
- 初始化：`npm i` → `npm run dev`
- 规范修复：`npm run lint:fix`
- 构建与预览：`npm run build && npm run preview`
- 链接检查：`npm run check:links`（需先 `build`）

**提示词（对 Claude Code）**：

> 任务：在 `src/pages/index.astro` 实现 Hero。  
> 要求：  
> - 文案来自 `src/content/home.json`  
> - 颜色使用 `var(--brand)`、`var(--accent)`  
> - CTA1 链接 `https://wiki.mpsteam.cn/`；CTA2 链接 `/about`  
> - 保持零 JS，移动优先，LCP 图片使用 `<Image />`

---

## 10) 任务清单（按序执行）

1. **项目脚手架**
   - `npm create astro@latest mpsteam-cn`（选择最简模板 + TS）
   - 添加 Tailwind、Lint、Stylelint、工具脚本
2. **样式与主题**
   - 写入 `tokens.css` 与 `theme.css`
   - 导入 Tailwind 与 Typography 插件
3. **基础组件**
   - `Nav.astro`：Logo、导航、移动菜单
   - `Hero.astro`：标题/副标题/两枚 CTA
   - `Feature.astro`、`Card.astro`、`Footer.astro`
4. **页面**
   - `index.astro`、`about.astro`、`join.astro`、`links.astro`
5. **资产**
   - Favicon、OG 图、`manifest.webmanifest`（可选 PWA）
6. **SEO**
   - `src/utils/seo.ts` 与全局布局注入
   - 生成 `sitemap` 与 `robots`
7. **QA**
   - `npm run build` → `check:links`、`check:a11y`
8. **部署**
   - 连接 Cloudflare Pages，设置构建指令与产物目录
   - 绑定 `mpsteam.cn`，验证生产首屏与路由

---

## 11) 代码范式（示例片段）

`src/pages/index.astro`（简化示例）

```astro
---
import Layout from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import Features from '../components/Features.astro';
---

<Layout title="MPS Team CN — 多意识体科普与社区">
  <Hero
    title="理解多意识体，从科学与同理出发"
    subtitle="我们提供面向大众与从业者的客观科普与社区导航，严谨而温暖。"
    primaryHref="https://wiki.mpsteam.cn/"
    primaryText="进入 Wiki"
    secondaryHref="/about"
    secondaryText="了解我们" />
  <Features />
</Layout>
```

`src/components/Hero.astro`

```astro
---
const { title, subtitle, primaryHref, primaryText, secondaryHref, secondaryText } = Astro.props;
---

<section class="py-20">
  <div class="mx-auto max-w-6xl px-6 text-center">
    <h1 class="text-4xl md:text-6xl font-extrabold" style="color:var(--fg)">{title}</h1>
    <p class="mt-6 text-lg md:text-xl text-slate-500">{subtitle}</p>
    <div class="mt-10 flex gap-4 justify-center">
      <a href={primaryHref} class="px-6 py-3 rounded-xl text-white" style="background:var(--brand)"> {primaryText} </a>
      <a href={secondaryHref} class="px-6 py-3 rounded-xl border" style="border-color:var(--border)"> {secondaryText} </a>
    </div>
  </div>
</section>
```

---

## 12) 质量门禁（Definition of Done）

- 与 Wiki 色板一致（`tokens.css` 已替换为真实色值）
- 关键路径零 JS；移动端 CLS < 0.1
- 所有外链可达；无 4xx/5xx
- a11y 主要检查通过（可读对比度/语义结构）
- PR 预览可用；生产域名与 `wiki.mpsteam.cn` 互链清晰

---

## 13) 后续扩展（Backlog）

- RSS/公告系统、更新日志
- 团队成员与招聘页
- 统计与事件追踪（无 Cookie 优先）
- i18n（en / zh-Hant）
- 轻量表单（Cloudflare Forms / 外部表单服务）

---

## 14) 安全与合规

- 不在前端暴露任何密钥
- 版权/免责声明页面
- 统一用语：**尊重、去污名化、以证据为依据**

---

## 15) 快速指令（给 Claude Code）

- 初始化页面与组件：
  - 「创建 `Nav/Hero/Features/Footer` 组件，样式用 `var(--brand)`，移动端先行」
- 对齐 Wiki 配色：
  - 「读取 Wiki 主题色，生成 `tokens.css` 对应变量（若未知先保留变量位点）」
- 性能检查：
  - 「为首页图像添加 `<Image />` 与懒加载；报告 LCP 资源体积并提出压缩建议」
- SEO：
  - 「生成 `seo.ts`，在 `Base.astro` 注入 meta/OG/Twitter 标签与结构化数据」
- 部署：
  - 「生成 Cloudflare Pages 配置说明与 `_headers`、`_redirects` 示例」

--- 

**完成标准**：合并到 `main` 后自动构建，`https://mpsteam.cn` 可访问；首页 Hero CTA 指向 `https://wiki.mpsteam.cn/`；样式与 Wiki 统一；基本 SEO/可访问性/性能检查通过。