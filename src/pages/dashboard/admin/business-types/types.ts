export type BusinessTypeRow = {
  id: string;
  category: string;
  type: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type CategoryOrderRow = {
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type CategoryGroup = {
  category: string;
  sort_order: number;
  types: BusinessTypeRow[];
};
