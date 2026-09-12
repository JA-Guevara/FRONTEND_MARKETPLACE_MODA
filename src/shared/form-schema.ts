export interface Option {
  value: string;
  label: string;
}
export interface Field {
  key: string;
  label: string;
  /**
   * Nombre del paso del asistente donde se muestra el campo. Los campos sin
   * sección heredan la del campo anterior. Si ningún campo declara sección, el
   * formulario agrupa de a seis campos por paso.
   */
  section?: string;
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
  /** Marca los sustantivos femeninos para decir «Nueva prenda» y no «Nuevo prenda». */
  feminine?: boolean;
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
