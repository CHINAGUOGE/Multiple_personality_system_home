import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '../public');

// 源图片路径
const sourceImage = join(publicDir, '下载 (1).png');
// OG 图片输出路径
const ogImagePath = join(publicDir, 'og-image.png');

// OG 图片标准尺寸
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function generateOGImage() {
  try {
    console.log('📦 开始生成 OG 图片...');
    console.log(`源文件: ${sourceImage}\n`);

    // 检查源文件是否存在
    if (!existsSync(sourceImage)) {
      throw new Error(`源文件不存在: ${sourceImage}`);
    }

    // 获取源图片信息
    const metadata = await sharp(sourceImage).metadata();
    console.log(`源图片尺寸: ${metadata.width}x${metadata.height}`);

    // 计算缩放比例（保持宽高比，填充整个 OG 画布）
    const sourceRatio = metadata.width / metadata.height;
    const targetRatio = OG_WIDTH / OG_HEIGHT;

    let resizeWidth, resizeHeight;

    if (sourceRatio > targetRatio) {
      // 源图片更宽，以高度为准
      resizeHeight = OG_HEIGHT;
      resizeWidth = Math.round(OG_HEIGHT * sourceRatio);
    } else {
      // 源图片更高或比例相同，以宽度为准
      resizeWidth = OG_WIDTH;
      resizeHeight = Math.round(OG_WIDTH / sourceRatio);
    }

    console.log(`缩放尺寸: ${resizeWidth}x${resizeHeight}`);

    // 生成 OG 图片：先缩放，然后居中裁剪
    await sharp(sourceImage)
      .resize(resizeWidth, resizeHeight, {
        fit: 'cover',
        position: 'center'
      })
      .extract({
        left: Math.round((resizeWidth - OG_WIDTH) / 2),
        top: Math.round((resizeHeight - OG_HEIGHT) / 2),
        width: OG_WIDTH,
        height: OG_HEIGHT
      })
      .png({
        quality: 90,
        compressionLevel: 9
      })
      .toFile(ogImagePath);

    console.log(`✅ OG 图片已生成: og-image.png (${OG_WIDTH}x${OG_HEIGHT})`);

    // 同时生成 Twitter 卡片尺寸（推荐 1200x600，但我们使用 1200x630 保持一致）
    const twitterImagePath = join(publicDir, 'twitter-card.png');
    await sharp(sourceImage)
      .resize(resizeWidth, resizeHeight, {
        fit: 'cover',
        position: 'center'
      })
      .extract({
        left: Math.round((resizeWidth - OG_WIDTH) / 2),
        top: Math.round((resizeHeight - OG_HEIGHT) / 2),
        width: OG_WIDTH,
        height: OG_HEIGHT
      })
      .png({
        quality: 90,
        compressionLevel: 9
      })
      .toFile(twitterImagePath);

    console.log(`✅ Twitter 卡片已生成: twitter-card.png (${OG_WIDTH}x${OG_HEIGHT})`);

    // 获取文件大小信息
    const { statSync } = await import('fs');
    const ogSize = statSync(ogImagePath).size;
    const twitterSize = statSync(twitterImagePath).size;

    console.log('\n📊 文件大小：');
    console.log(`  - og-image.png: ${(ogSize / 1024).toFixed(2)} KB`);
    console.log(`  - twitter-card.png: ${(twitterSize / 1024).toFixed(2)} KB`);

    console.log('\n🎉 所有社交媒体图片生成完成！');
    console.log('\n使用说明：');
    console.log('  1. og-image.png 用于 Facebook、LinkedIn 等 Open Graph 协议');
    console.log('  2. twitter-card.png 用于 Twitter/X 卡片');
    console.log('  3. 更新 src/utils/seo.ts 中的 defaultOGImage 配置');

  } catch (error) {
    console.error('❌ 生成 OG 图片失败:', error.message);
    process.exit(1);
  }
}

generateOGImage();
