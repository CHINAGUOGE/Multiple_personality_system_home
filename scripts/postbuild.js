#!/usr/bin/env node

/**
 * Post-build script
 * 构建完成后的清理和验证任务
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const DIST_DIR = 'dist';

async function getDirectorySize(dir) {
  let size = 0;
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      size += await getDirectorySize(path);
    } else {
      const stats = await stat(path);
      size += stats.size;
    }
  }

  return size;
}

async function main() {
  try {
    console.log('📦 Running post-build checks...\n');

    // 检查构建产物大小
    const size = await getDirectorySize(DIST_DIR);
    const sizeMB = (size / 1024 / 1024).toFixed(2);

    console.log(`✅ Build output size: ${sizeMB} MB`);

    if (size > 10 * 1024 * 1024) {
      console.warn('⚠️  Build output is larger than 10MB. Consider optimization.');
    }

    console.log('\n✨ Post-build checks completed!\n');
  } catch (error) {
    console.error('❌ Post-build check failed:', error.message);
    // Don't fail the build
    process.exit(0);
  }
}

main();
