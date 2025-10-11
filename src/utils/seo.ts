export interface SEOProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  canonical?: string;
}

export function generateSEOMeta(props: SEOProps) {
  const {
    title,
    description,
    ogImage = '/og-image.png',
    ogType = 'website',
    canonical,
  } = props;

  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogType,
    canonical,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
  };
}

export const defaultSEO: SEOProps = {
  title: 'MPS Team CN — 多意识体科普与社区',
  description: '我们提供面向大众与从业者的客观科普与社区导航，严谨而温暖。',
};
