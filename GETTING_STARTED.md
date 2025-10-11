# 快速开始指南

## 前置要求

- Node.js 20+
- npm 或 pnpm
- Git

## 安装与开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
# 访问 http://localhost:4321

# 3. 构建生产版本
npm run build

# 4. 预览构建结果
npm run preview
```

## 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复格式问题
npm run lint:fix
```

## 项目结构

```
.
├── public/              # 静态资源
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/      # 可复用组件
│   │   ├── Nav.astro
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   ├── Card.astro
│   │   └── Footer.astro
│   ├── content/         # 内容数据
│   │   └── home.json
│   ├── layouts/         # 页面布局
│   │   └── Base.astro
│   ├── pages/           # 路由页面
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── join.astro
│   │   ├── links.astro
│   │   └── 404.astro
│   ├── styles/          # 全局样式
│   │   ├── tokens.css   # 设计令牌
│   │   └── theme.css    # 主题样式
│   └── utils/           # 工具函数
│       └── seo.ts
├── scripts/             # 构建脚本
│   └── postbuild.js
└── astro.config.mjs     # Astro 配置
```

## 开发指南

### 添加新页面

在 `src/pages/` 中创建 `.astro` 文件：

```astro
---
import Layout from '../layouts/Base.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
---

<Layout title="页面标题">
  <Nav />
  <main>
    <!-- 页面内容 -->
  </main>
  <Footer />
</Layout>
```

### 修改样式

- **设计令牌**: 编辑 `src/styles/tokens.css`
- **全局样式**: 编辑 `src/styles/theme.css`
- **组件样式**: 使用 Tailwind 类名或内联样式与 CSS 变量

### 添加组件

在 `src/components/` 中创建 `.astro` 文件并导出 Props 接口。

### 更新内容

编辑 `src/content/` 中的 JSON 文件以更新文案。

## 常见任务

### 同步 Wiki 配色

1. 访问 Wiki 站点获取最新色值
2. 更新 `src/styles/tokens.css` 中的 CSS 变量
3. 确保颜色对比度符合无障碍标准

### 添加 OG 图片

1. 创建 1200x630px 的分享图
2. 保存为 `public/og-image.png`
3. 图片会自动被 SEO meta 标签引用

### 更新导航

编辑 `src/components/Nav.astro` 中的 `navItems` 数组。

## 部署

参考 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解 Cloudflare Pages 部署详情。

## 质量检查

```bash
# 构建并检查链接
npm run build
npm run check:links

# 可访问性检查（需先启动 preview）
npm run preview
# 在另一个终端运行
npm run check:a11y
```

## 故障排除

### 依赖安装失败

```bash
# 清理缓存重试
rm -rf node_modules package-lock.json
npm install
```

### 构建失败

检查以下内容：
1. Node 版本是否 >= 20
2. 所有导入路径是否正确
3. 图片文件是否存在

### 样式不生效

1. 确保 CSS 变量在 `tokens.css` 中定义
2. 检查 Tailwind 配置是否正确
3. 清空浏览器缓存重试

## 更多资源

- [Astro 文档](https://docs.astro.build)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
