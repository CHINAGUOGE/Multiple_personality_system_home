# MPS Team CN 官网

> 基于 Astro 的多意识体科普与社区官方网站

## 技术栈

- **框架**: Astro 6.x + TypeScript
- **样式**: Tailwind CSS + CSS Variables
- **部署**: Cloudflare Pages
- **质量**: ESLint + Prettier + Stylelint + Markdownlint

## 环境要求

- **Node.js**: `>=22.12.0`
- 仓库根目录同时提供 `.node-version` 与 `.nvmrc`，用于本地和 CI 固定 Node 版本。
- 如果 Cloudflare Pages 仍使用旧项目配置，请在项目设置中将 `NODE_VERSION` 设为 `22.12.0` 或更高，或升级到支持 Node 22 的构建镜像。

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint

# 自动修复
npm run lint:fix
```

## 项目结构

```text
.
├─ src/                    # 主站源码入口
│  ├─ components/          # 主站组件
│  ├─ content/             # 主站内容数据
│  ├─ layouts/             # 页面布局
│  ├─ pages/               # 主站页面路由
│  ├─ styles/              # 全局样式与主题变量
│  └─ utils/               # 工具函数
├─ public/                 # 主站静态资源
├─ lab-src/                # Lab 子站 Astro 源码
│  └─ pages/               # Lab 首页与 sitemap 路由
├─ lab-public/             # Lab 子站静态项目与资源
│  ├─ img/                 # Lab 项目封面图
│  ├─ little-travel-cat/   # 小旅猫
│  ├─ race/                # 横线赛车经营赛
│  └─ throw-battle/        # 后院投掷赛
├─ scripts/                # 构建、SEO、图标与分析注入脚本
├─ tools/                  # 本地辅助检查工具
├─ astro.config.mjs        # 主站 Astro 配置
├─ astro.config.lab.mjs    # Lab 子站 Astro 配置
├─ tailwind.config.ts      # Tailwind 配置
├─ eslint.config.js        # ESLint 配置
└─ package.json            # 项目脚本与依赖声明
```

## 链接

- 官网: <https://mpsteam.cn>
- Wiki: <https://wiki.mpsteam.cn>
- GitHub: <https://github.com/mps-team-cn>
- Lab: <https://Lab.com/mps-team-cn>

## 协议

遵循 MPS Team 统一协议
