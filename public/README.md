# 静态资源

此目录包含网站的静态资源文件。

## 当前文件

- `favicon.svg` - 网站图标（SVG 格式）
- `robots.txt` - 搜索引擎爬虫规则
- `site.webmanifest` - PWA 清单文件

## SEO 必需资源（待添加）

### Favicons
- `favicon-16x16.png` - 16x16 像素 favicon
- `favicon-32x32.png` - 32x32 像素 favicon
- `apple-touch-icon.png` - Apple 设备图标（180x180px）
- `android-chrome-192x192.png` - Android Chrome 图标（192x192px）
- `android-chrome-512x512.png` - Android Chrome 图标（512x512px）

### Open Graph / Social Sharing
- `og-image.png` - 默认 OG 分享图（推荐尺寸：1200x630px）
- `og-image-home.png` - 首页专用分享图（可选）
- `og-image-about.png` - 关于页面分享图（可选）
- `logo.png` - 品牌 Logo（用于结构化数据，推荐 512x512px）

### PWA Icons（可选但推荐）
- `icon-192.png` - 192x192 PWA 图标
- `icon-512.png` - 512x512 PWA 图标

## 图片规格要求

### Favicon
- **格式**: PNG（透明背景）
- **尺寸**: 16x16、32x32、180x180（Apple）
- **优化**: 使用 TinyPNG 或 ImageOptim 压缩

### OG Image
- **格式**: PNG 或 JPG
- **尺寸**: 1200x630px（Facebook/Twitter/LinkedIn 推荐）
- **纵横比**: 1.91:1
- **文件大小**: < 8MB（Facebook 限制）
- **内容安全区**: 中心 1200x600px 区域放置关键内容
- **设计建议**:
  - 包含网站名称和 Logo
  - 简洁清晰的视觉层次
  - 高对比度文字（确保可读性）
  - 避免边缘放置重要内容（可能被裁剪）

### Android Chrome Icons
- **格式**: PNG（透明背景）
- **尺寸**: 192x192、512x512px
- **用途**: PWA 安装和启动画面

### 品牌 Logo
- **格式**: PNG（透明背景）
- **尺寸**: 512x512px（正方形）
- **用途**: Schema.org 结构化数据、社交媒体

## 生成工具推荐

- **Favicon Generator**: [RealFaviconGenerator](https://realfavicongenerator.net/)
- **Image Optimization**: [TinyPNG](https://tinypng.com/), [Squoosh](https://squoosh.app/)
- **OG Image Design**: Figma, Canva
- **批量调整**: ImageMagick, Sharp

## 快速生成命令（使用 ImageMagick）

```bash
# 从 SVG 生成多尺寸 PNG favicon
magick favicon.svg -resize 16x16 favicon-16x16.png
magick favicon.svg -resize 32x32 favicon-32x32.png
magick favicon.svg -resize 180x180 apple-touch-icon.png
magick favicon.svg -resize 192x192 android-chrome-192x192.png
magick favicon.svg -resize 512x512 android-chrome-512x512.png

# 优化 OG 图片
magick og-image-source.png -resize 1200x630 -quality 85 og-image.png
```

## 验证清单

- [ ] 所有 favicon 尺寸已生成
- [ ] OG 图片符合 1200x630 规范
- [ ] 图片文件已优化（< 200KB for OG, < 50KB for icons）
- [ ] 透明背景图标正确导出
- [ ] 使用 [Twitter Card Validator](https://cards-dev.twitter.com/validator) 验证
- [ ] 使用 [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) 验证
- [ ] 使用 [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) 验证

## 相关链接

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
