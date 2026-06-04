# Repository Notes

- 当前仓库是 Astro 主站项目，主站入口在 `src/`，主站静态资源在 `public/`。
- 不要破坏主站现有构建流程；主站继续使用 `astro.config.mjs` 和原有 `npm run build`。
- Lab 子站使用独立配置 `astro.config.lab.mjs`。
- Lab 构建命令是 `npm run build:lab`。
- Lab 输出目录是 `dist-lab`。
- `lab-public/race/` 对应线上 `https://lab.mpsteam.cn/race/`。
- `race` 的 CSS、JS、图片、音频等资源路径必须使用相对路径，避免 `/race/` 部署后 404。
- `race` 是 XP/VB 风格复古横线赛车经营小游戏，不要改成现代 UI。
