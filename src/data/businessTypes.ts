export interface BusinessTypeCategory {
  category: string;
  types: string[];
}

export const businessTypeCategories: BusinessTypeCategory[] = [
  {
    category: 'Home Services',
    types: [
      'Towing Service',
      'Plumbing Service',
      'HVAC Service',
      'Electrician',
      'Pest Control Service',
      'Roofing Contractor',
      'House Cleaning Service',
      'Carpet Cleaning Service',
      'Junk Removal Service',
      'Lawn Care / Landscaping',
      'Pool Cleaning Service',
      'Handyman Service',
    ],
  },
  {
    category: 'Automotive Local Businesses',
    types: [
      'Auto Repair Shop',
      'Auto Body Shop',
      'Mobile Mechanic',
      'Car Detailing Service',
      'Tire Shop',
      'Auto Glass Repair',
    ],
  },
  {
    category: 'Health & Wellness',
    types: [
      'Dental Clinic',
      'Chiropractic Clinic',
      'Physical Therapy',
      'Medical Spa',
      'Massage Therapy',
      'Mental Health Practice',
      'Home Health Care',
    ],
  },
  {
    category: 'Food & Beverage',
    types: [
      'Restaurant',
      'Coffee Shop',
      'Bakery',
      'Food Truck',
      'Catering Service',
    ],
  },
  {
    category: 'Real Estate & Property',
    types: [
      'Real Estate Agent',
      'Property Management',
      'Airbnb Host',
      'Real Estate Investor',
    ],
  },
  {
    category: 'Beauty & Personal Care',
    types: [
      'Hair Salon',
      'Barber Shop',
      'Nail Salon',
      'Lash & Brow Studio',
      'Beauty Clinic',
    ],
  },
  {
    category: 'Education & Training',
    types: [
      'Daycare / Childcare',
      'Tutoring Service',
      'Test Prep Center',
      'Online Coach',
      'Course Creator',
    ],
  },
  {
    category: 'Creative & Media Services',
    types: [
      'Photography',
      'Videography',
      'Wedding Organizer',
      'Event Planner',
    ],
  },
  {
    category: 'Online Small Businesses',
    types: [
      'E-commerce Store',
      'Dropshipping Store',
      'Affiliate Marketer',
      'Content Creator',
      'YouTube Channel Owner',
    ],
  },
  {
    category: 'Others',
    types: ['Other'],
  },
];