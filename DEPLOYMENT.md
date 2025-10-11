# Cloudflare Pages 部署指南

## 配置说明

### 构建设置

在 Cloudflare Pages 项目设置中配置以下参数：

- **Framework preset**: `Astro`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Node version**: `20`

### 环境变量

在 Cloudflare Pages 项目设置的「Environment variables」中添加：

```
NODE_VERSION=20
TZ=Asia/Shanghai
ASTRO_TELEMETRY_DISABLED=1
```

### 自定义域名

1. 在 Cloudflare Pages 项目的「Custom domains」中添加：
   - `mpsteam.cn`
   - `www.mpsteam.cn` (可选，重定向到主域名)

2. DNS 配置会自动完成

### 部署分支

- **Production branch**: `main` 或 `master`
- **Preview branches**: 所有分支（自动生成预览链接）

## 可选配置

### _headers 文件

在 `public/_headers` 中配置 HTTP 响应头（如需要）：

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
```

### _redirects 文件

在 `public/_redirects` 中配置重定向规则（如需要）：

```
# 重定向 www 到根域名
https://www.mpsteam.cn/* https://mpsteam.cn/:splat 301!

# SPA 路��支持（如需要）
# /* /index.html 200
```

## 部署流程

1. 推送代码到 GitHub 仓库
2. 连接 Cloudflare Pages 到该仓库
3. 配置上述构建设置
4. 触发首次部署
5. 验证部署结果

## 性能优化

- 启用 Cloudflare CDN 缓存
- 配置 Cache-Control 头
- 使用 Cloudflare Web Analytics（无需密钥）

## 监控

访问 Cloudflare Pages 控制台查看：
- 构建日志
- 部署历史
- 访问分析
- 错误日志
