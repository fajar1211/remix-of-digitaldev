export interface GrowingPackage {
  id: string;
  name: string;
  type: 'optimize' | 'scale' | 'dominate';
  description: string;
  price: number;
  features: string[];
}

export const growingPackages: GrowingPackage[] = [
  {
    id: 'optimize',
    name: 'Optimize',
    type: 'optimize',
    description: 'For businesses already listed on Google Maps',
    price: 400,
    features: [
      'Google Maps audit & optimization',
      'Category, service & description optimization',
      '4 GMB posts / month',
      'Call-to-action optimization',
      'Review response strategy',
      'Monthly performance summary',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    type: 'scale',
    description: 'For businesses ready to grow faster',
    price: 600,
    features: [
      'Everything in Optimize',
      '8 GMB posts / month',
      'Review management (response + request strategy)',
      'Basic local SEO signals',
      'Conversion-focused website optimization (existing site)',
      'Monthly support & reporting',
    ],
  },
  {
    id: 'dominate',
    name: 'Dominate',
    type: 'dominate',
    description: 'For competitive local markets',
    price: 900,
    features: [
      'Everything in Scale',
      'Advanced Google Maps optimization',
      'Competitor monitoring',
      'Local SEO content (4 pieces / month)',
      'Website content expansion & CRO',
      'Priority support',
      'Monthly strategy call',
    ],
  },
];

export const growingPackageAddOns = {
  optimize: [],
  scale: [
    { id: 'extra_seo_content', label: 'Extra local SEO content', pricePerUnit: 150, unitStep: 1, unit: 'piece' },
    { id: 'extra_gmb_posts', label: 'Extra GMB posts', pricePerUnit: 100, unitStep: 4, unit: 'posts' },
  ],
  dominate: [
    { id: 'extra_seo_content', label: 'Extra local SEO content', pricePerUnit: 150, unitStep: 1, unit: 'piece' },
    { id: 'extra_gmb_posts', label: 'Extra GMB posts', pricePerUnit: 100, unitStep: 4, unit: 'posts' },
    { id: 'review_automation', label: 'Review request automation setup', pricePerUnit: 100, unitStep: 1, unit: 'one-time' },
    { id: 'logo_refresh', label: 'Simple logo refresh', pricePerUnit: 150, unitStep: 1, unit: 'one-time' },
  ],
};
