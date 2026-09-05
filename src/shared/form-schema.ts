export interface Option {
  value: string;
  label: string;
}
export interface Field {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'textarea'
    | 'number'
    | 'date'
    | 'url'
    | 'checkbox'
    | 'select'
    | 'multi'
    | 'hours';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: Option[];
  lookup?: string;
  lookupLabel?: string;
  createOnly?: boolean;
  default?: unknown;
  hint?: string;
}
export interface Resource {
  key: string;
  title: string;
  singular: string;
  path: string;
  listPath?: string;
  group: string;
  permission?: string;
  writePermission?: string;
  fields: Field[];
  columns: { key: string; label: string }[];
  paginated?: boolean;
  softDelete?: boolean;
  states?: boolean;
  search?: boolean;
}
