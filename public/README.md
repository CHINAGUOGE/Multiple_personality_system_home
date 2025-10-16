# Public Assets

本目录包含网站的静态资源文件。

## Favicon 文件

所有 favicon 文件都是通过 `scripts/generate-favicons.js` 脚本自动生成的。

### 可用的图标文件

- `favicon.png` (32x32) - 主要的网站图标
- `favicon-16x16.png` (16x16) - 小尺寸图标
- `favicon-32x32.png` (32x32) - 标准尺寸图标
- `favicon-48x48.png` (48x48) - 中等尺寸图标
- `apple-touch-icon.png` (180x180) - iOS 主屏幕图标
- `android-chrome-192x192.png` (192x192) - Android Chrome 图标
- `android-chrome-512x512.png` (512x512) - 高分辨率 Android 图标

### 重新生成 Favicon

如果需要更新 favicon，请：

1. 准备一个高分辨率的源图片（建议 1024x1024 或更大），命名为 `favicon-source.png`
2. 将源图片放在 `public/` 目录
3. 修改 `scripts/generate-favicons.js` 中的源文件路径
4. 运行脚本：`node scripts/generate-favicons.js`

脚本会自动生成所有需要的尺寸。

## 社交媒体分享图片

所有 Open Graph 和 Twitter 卡片图片都是通过 `scripts/generate-og-image.js` 脚本自动生成的。

### 可用的分享图片

- `og-image.png` (1200x630) - Open Graph 图片，用于 Facebook、LinkedIn 等社交媒体分享
- `twitter-card.png` (1200x630) - Twitter/X 卡片图片

### 重新生成社交媒体图片

如果需要更新 OG 图片，请：

1. 准备一个高质量的源图片，建议尺寸大于 1200x630
2. 将源图片放在 `public/` 目录
3. 修改 `scripts/generate-og-image.js` 中的源文件路径
4. 运行脚本：`node scripts/generate-og-image.js`

脚本会自动按照 Open Graph 标准尺寸（1200x630）生成图片，并进行智能裁剪和优化。

## PWA Manifest

- `site.webmanifest` - Progressive Web App 清单文件，定义了应用名称、图标和主题色

## 其他资源

根据需要添加其他静态资源（图片、字体、文档等）。

## 文件管理建议

### 源文件处理

- OG 图片的源文件（如 `下载 (1).png`）在生成完 `og-image.png` 后可以移除，以减少仓库大小
- 建议保留原始源文件的备份在其他位置（如设计资源文件夹），不提交到 Git 仓库
- 生成的优化图片（`og-image.png`、`twitter-card.png`）应该提交到仓库，供网站使用

### .gitignore 建议

建议在 `.gitignore` 中添加以下规则，避免临时文件和源文件被提交：

```
# 临时源文件
public/*源*.png
public/*下载*.png
public/*source*.png
```
