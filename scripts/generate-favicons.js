import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '../public');

// 确保 public 目录存在
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const sourceImage = join(publicDir, 'favicon.png');

// 定义需要生成的图标尺寸
const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
];

async function generateFavicons() {
  try {
    console.log('📦 开始生成 favicon...');
    console.log(`源文件: ${sourceImage}\n`);

    // 检查源文件是否存在
    if (!existsSync(sourceImage)) {
      throw new Error(`源文件不存在: ${sourceImage}`);
    }

    // 获取源图片信息
    const metadata = await sharp(sourceImage).metadata();
    console.log(`源图片尺寸: ${metadata.width}x${metadata.height}\n`);

    // 生成各种尺寸的图标
    for (const { size, name } of sizes) {
      const outputPath = join(publicDir, name);

      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ 生成: ${name} (${size}x${size})`);
    }

    // 生成标准的 favicon.ico（包含 16x16 和 32x32）
    // 注意：sharp 不直接支持 .ico 格式，这里生成 32x32 的 PNG 作为主 favicon
    const mainFaviconPath = join(publicDir, 'favicon.png');
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(mainFaviconPath + '.tmp');

    // 重命名回原文件（覆盖大尺寸的源文件）
    const { renameSync } = await import('fs');
    renameSync(mainFaviconPath + '.tmp', mainFaviconPath);

    console.log(`✅ 更新: favicon.png (32x32) - 主图标`);

    console.log('\n🎉 所有 favicon 生成完成！');
    console.log('\n生成的文件列表：');
    console.log('  - favicon.png (32x32) - 主图标');
    sizes.forEach(({ name, size }) => {
      console.log(`  - ${name} (${size}x${size})`);
    });

  } catch (error) {
    console.error('❌ 生成 favicon 失败:', error.message);
    process.exit(1);
  }
}

generateFavicons();
