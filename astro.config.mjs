import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://mpsteam.cn',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // 自定义 sitemap 配置
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // 排除不需要索引的页面
      filter: (page) => !page.includes('/404'),
      // 自定义页面优先级
      customPages: [
        'https://mpsteam.cn/', // 首页最高优先级
      ],
      // 添加额外的 URL（如 Wiki 链接参考）
      serialize(item) {
        // 首页优先级最高
        if (item.url === 'https://mpsteam.cn/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        }
        // 主要页面高优先级
        else if (
          item.url.includes('/about') ||
          item.url.includes('/join') ||
          item.url.includes('/contact')
        ) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        }
        // 其他页面标准优先级
        else {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
