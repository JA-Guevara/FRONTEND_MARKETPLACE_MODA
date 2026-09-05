export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
// Dynamic records are restricted to the schema-driven administration boundary.
export interface Entity {
  id: string;
  [key: string]: any;
}
export interface Permission {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
}
export interface Role {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  permissions: Permission[];
}
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: Role[];
}
export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}
export interface Product extends Entity {
  name: string;
  slug: string;
  description: string;
  brand: string;
  gender: string;
  base_price: number | string;
  category: Entity;
  season: Entity | null;
  collection: Entity | null;
  is_featured: boolean;
  variants: Entity[];
  images: Entity[];
  ar_assets: Entity[];
  suppliers?: Entity[];
}
