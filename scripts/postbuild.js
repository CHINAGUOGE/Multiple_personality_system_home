#!/usr/bin/env node

/**
 * Post-build script
 * 构建完成后的清理和验证任务
 */

import { cp, readFile, readdir, rm, stat } from 'fs/promises';
import { join } from 'path';

const DIST_DIR = 'dist';
const WRANGLER_CONFIG = 'wrangler.toml';

async function getWranglerPagesBuildOutputDir() {
  try {
    const config = await readFile(WRANGLER_CONFIG, 'utf8');
    const match = config.match(/^\s*pages_build_output_dir\s*=\s*"([^"]+)"/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function syncPagesOutputDirectory() {
  const pagesOutputDir = await getWranglerPagesBuildOutputDir();

  if (!pagesOutputDir || pagesOutputDir === DIST_DIR) {
    return;
  }

  await rm(pagesOutputDir, { recursive: true, force: true });
  await cp(DIST_DIR, pagesOutputDir, { recursive: true });
  console.log(`✅ Synced ${DIST_DIR}/ to ${pagesOutputDir}/ for Cloudflare Pages upload`);
}

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

    await syncPagesOutputDirectory();

    console.log('\n✨ Post-build checks completed!\n');
  } catch (error) {
    console.error('❌ Post-build check failed:', error.message);
    // Don't fail the build
    process.exit(0);
  }
}

main();
