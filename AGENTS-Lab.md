# AGENTS-Lab.md

本文件是 Lab 子站专项规则。只有任务涉及 Lab 范围时才需要加载。

当本文件与主站 AGENTS.md 冲突时：

- 涉及 Lab 范围的任务，以本文件为准；
- 不涉及 Lab 的任务，仍以主站 AGENTS.md 为准。

## 适用范围

以下路径和命令属于 Lab 范围：

- Lab 源码入口：`lab-src/`
- Lab 静态资源：`lab-public/`
- Lab 配置：`astro.config.lab.mjs`
- Lab 构建输出：`dist-lab/`
- Lab 分析注入脚本：`scripts/inject-lab-analytics.mjs`
- Lab 构建命令：`npm run build:lab`

## 构建与发布

- Lab 子站使用独立 Astro 配置：`astro.config.lab.mjs`。
- `astro.config.lab.mjs` 当前配置：
  - `srcDir`: `./lab-src`
  - `publicDir`: `./lab-public`
  - `outDir`: `./dist-lab`
  - `site`: `https://lab.mpsteam.cn`
- Lab 构建命令是 `npm run build:lab`。
- `npm run build:lab` 会先执行 `astro build --config astro.config.lab.mjs`，再执行 `scripts/inject-lab-analytics.mjs` 注入 Cloudflare Web Analytics。
- 不要把 Lab 构建配置合并进主站 `astro.config.mjs`。
- 不要把 Lab 输出目录 `dist-lab/` 当作源码修改。

## 当前 Lab 项目

- Lab 首页：`lab-src/pages/index.astro`
- Lab 站点地图：`lab-src/pages/sitemap.xml.ts`
- 横线赛车经营赛：
  - 目录：`lab-public/race/`
  - 线上路径：`https://lab.mpsteam.cn/race/`
  - 说明：`lab-public/race/README.md`
- 后院投掷赛：
  - 目录：`lab-public/throw-battle/`
  - 线上路径：`https://lab.mpsteam.cn/throw-battle/`
- 小旅猫：
  - 目录：`lab-public/little-travel-cat/`
  - 线上路径：`https://lab.mpsteam.cn/little-travel-cat/`
  - 说明：`lab-public/little-travel-cat/README.md`
- Lab 入口页封面图：
  - 目录：`lab-public/img/`
  - 说明：`lab-public/img/README.md`

## 开发原则

- Lab 子站与主站解耦；修改 Lab 时不要顺手改主站 `src/`、`public/` 或 `astro.config.mjs`。
- 修改 Lab 首页项目卡片时，同步检查 `lab-src/pages/index.astro` 中的 `projects` 数组、封面图路径和线上路径。
- 替换 Lab 封面图时，同步检查 `lab-public/img/README.md` 与 `lab-src/pages/index.astro`。
- 修改具体小游戏前，先阅读对应目录下的 `README.md`、`CHANGELOG.md` 和现有文件结构。
- 纯静态小游戏应优先保持单目录可运行，避免引入会破坏独立预览的构建依赖。
- 新增 Lab 项目时，应同时考虑：
  - `lab-public/<project>/` 静态资源目录
  - `lab-src/pages/index.astro` 项目入口卡片
  - `lab-src/pages/sitemap.xml.ts` 站点地图
  - `lab-public/img/` 封面图

## 检查要求

- 只改 Lab 文档或说明时，可以不执行构建，但需要在最终回复说明未执行原因。
- 修改 `lab-src/`、`lab-public/`、`astro.config.lab.mjs` 或 Lab 构建脚本时，优先执行：

```bash
npm run build:lab
```

- 如果改动也影响主站入口、主站导航或共享脚本，需要额外评估是否执行：

```bash
npm run build
```

## 输出要求

涉及 Lab 的任务完成后，请额外说明：

```text
Lab 影响：
- 是否影响 lab-src
- 是否影响 lab-public
- 是否影响 npm run build:lab
```
