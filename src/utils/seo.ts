/**
 * SEO 工具函数
 * 生成 Meta 标签、结构化数据等
 */

export interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * 生成完整的页面标题
 */
export function getFullTitle(pageTitle: string): string {
  if (pageTitle === 'MPS Team CN' || pageTitle.includes('MPS Team CN')) {
    return pageTitle;
  }
  return `${pageTitle} | MPS Team CN`;
}

/**
 * 生成规范 URL
 */
export function getCanonicalURL(path: string, site: string = 'https://mpsteam.cn'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${site}${cleanPath}`;
}

/**
 * 生成 SEO Meta 数据
 */
export function generateSEOMeta(props: SEOProps) {
  const {
    title,
    description,
    ogImage = '/og-image.png',
    ogType = 'website',
    canonical,
    keywords = DEFAULT_KEYWORDS,
    author,
    publishedTime,
    modifiedTime,
    noindex = false,
  } = props;

  return {
    title: getFullTitle(title),
    description,
    keywords: keywords.join(', '),
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogType,
    ogUrl: canonical,
    canonical,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
    author,
    publishedTime,
    modifiedTime,
    noindex,
  };
}

/**
 * 生成 Organization 结构化数据
 */
export function getOrganizationSchema(site: string = 'https://mpsteam.cn') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MPS Team CN',
    alternateName: '多重人格系统团队',
    url: site,
    logo: `${site}/logo.png`,
    description: '专注于多意识体科普与社区建设的非营利组织',
    sameAs: [
      'https://github.com/mps-team-cn',
      'https://wiki.mpsteam.cn',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'team@mpsteam.cn',
      contactType: '客服支持',
      availableLanguage: ['zh-CN'],
    },
  };
}

/**
 * 生成 WebSite 结构化数据
 */
export function getWebSiteSchema(site: string = 'https://mpsteam.cn') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MPS Team CN',
    alternateName: '多意识体科普社区',
    url: site,
    description: '提供面向大众与从业者的多意识体客观科普与社区导航',
    inLanguage: 'zh-CN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://wiki.mpsteam.cn/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * 生成 BreadcrumbList 结构化数据
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[], site: string = 'https://mpsteam.cn') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${site}${item.url}`,
    })),
  };
}

/**
 * 生成 Article 结构化数据
 */
export function getArticleSchema(props: {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  image?: string;
}) {
  const { title, description, url, datePublished, dateModified, author, image } = props;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || datePublished || new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: author || 'MPS Team CN',
      url: 'https://mpsteam.cn',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MPS Team CN',
      url: 'https://mpsteam.cn',
      logo: {
        '@type': 'ImageObject',
        url: 'https://mpsteam.cn/logo.png',
      },
    },
    image: image || 'https://mpsteam.cn/og-image.png',
  };
}

/**
 * 默认关键词
 */
export const DEFAULT_KEYWORDS = [
  '多意识体',
  '多重人格',
  'DID',
  'OSDD',
  '分离性身份障碍',
  '心理健康',
  '科普',
  '社区',
  'MPS',
  'Multiple Personality System',
];

/**
 * 默认 OG 图片
 */
export const DEFAULT_OG_IMAGE = '/og-image.png';

/**
 * 默认 SEO 配置
 */
export const defaultSEO: SEOProps = {
  title: 'MPS Team CN — 多意识体科普与社区',
  description: '我们提供面向大众与从业者的客观科普与社区导航，严谨而温暖。',
  keywords: DEFAULT_KEYWORDS,
};

/**
 * 站点配置
 */
export const SITE_CONFIG = {
  name: 'MPS Team CN',
  url: 'https://mpsteam.cn',
  description: '提供面向大众与从业者的多意识体客观科普与社区导航，严谨而温暖。',
  defaultOGImage: DEFAULT_OG_IMAGE,
  twitterHandle: '@mpsteamcn',
  locale: 'zh_CN',
};
