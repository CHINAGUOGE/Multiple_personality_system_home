import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-600': 'var(--brand-600)',
        accent: 'var(--accent)',
        muted: 'var(--muted)',
      },
      borderRadius: {
        xl: 'var(--radius)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
