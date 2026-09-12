import { Field, Resource } from '../../../shared/form-schema';
export const nameField: Field = {
  key: 'name',
  label: 'Nombre',
  required: true,
  minLength: 2,
  maxLength: 100,
};
export const description: Field = { key: 'description', label: 'Descripción', type: 'textarea' };
export const lookup = (key: string, label: string, path: string, required = false): Field => ({
  key,
  label,
  type: 'select',
  lookup: path,
  required,
});
/**
 * Agrupa campos en un paso con nombre del asistente. Los formularios con pocos
 * campos no usan secciones: se muestran en una sola pantalla.
 */
export const section = (name: string, fields: Field[]): Field[] =>
  fields.map((field) => ({ ...field, section: name }));
const catalog = '/catalog/admin';
const reference = (
  key: string,
  title: string,
  singular: string,
  fields: Field[],
  columns = [{ key: 'name', label: 'Nombre' }],
  feminine = true,
): Resource => ({
  key,
  title,
  singular,
  feminine,
  path: `${catalog}/${key}`,
  group: 'Catálogo',
  permission: 'catalog.read',
  writePermission: 'catalog.write',
  states: true,
  fields,
  columns,
});
export const catalogResources: Resource[] = [
  {
    key: 'users',
    title: 'Usuarios',
    singular: 'usuario',
    path: '/users',
    group: 'Acceso y seguridad',
    permission: 'users.read',
    writePermission: 'users.write',
    paginated: true,
    softDelete: true,
    states: true,
    search: true,
    columns: [
      { key: 'first_name', label: 'Nombre' },
      { key: 'last_name', label: 'Apellido' },
      { key: 'email', label: 'Correo' },
      { key: 'roles', label: 'Roles' },
    ],
    fields: [
      ...section('Acceso', [
        { key: 'email', label: 'Correo electrónico', type: 'email', required: true },
        {
          key: 'password',
          label: 'Contraseña inicial',
          type: 'password',
          required: true,
          createOnly: true,
          minLength: 12,
          maxLength: 128,
          hint: '12 caracteres como mínimo, mayúscula, minúscula, número y símbolo.',
        },
      ]),
      ...section('Datos personales', [
        { ...nameField, key: 'first_name', label: 'Nombres' },
        { ...nameField, key: 'last_name', label: 'Apellidos' },
        { key: 'phone', label: 'Teléfono', maxLength: 30 },
        { key: 'document_number', label: 'Documento de identidad', maxLength: 50 },
      ]),
      ...section('Roles y verificación', [
        {
          key: 'role_ids',
          label: 'Roles',
          type: 'multi',
          lookup: '/roles',
          required: true,
          createOnly: true,
        },
        { key: 'is_verified', label: 'Correo verificado', type: 'checkbox' },
      ]),
    ],
  },
  {
    key: 'roles',
    title: 'Roles',
    singular: 'rol',
    path: '/roles',
    group: 'Acceso y seguridad',
    permission: 'roles.read',
    writePermission: 'roles.write',
    states: true,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código' },
      { key: 'permissions', label: 'Permisos' },
    ],
    fields: [
      ...section('Identificación', [
        {
          key: 'code',
          label: 'Código',
          required: true,
          createOnly: true,
          maxLength: 50,
          pattern: '^[a-z][a-z0-9_]*$',
          hint: 'Minúsculas y guion bajo. Ejemplo: gestor_catalogo',
        },
        nameField,
        description,
      ]),
      ...section('Permisos', [
        {
          key: 'permission_ids',
          label: 'Permisos',
          type: 'multi',
          lookup: '/roles/permissions/all',
          createOnly: true,
        },
      ]),
    ],
  },
  {
    key: 'permissions',
    title: 'Permisos',
    singular: 'permiso',
    path: '/roles/permissions',
    listPath: '/roles/permissions/all',
    group: 'Acceso y seguridad',
    permission: 'roles.read',
    writePermission: 'roles.write',
    states: true,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código' },
      { key: 'module', label: 'Módulo' },
    ],
    fields: [
      {
        key: 'code',
        label: 'Código',
        required: true,
        createOnly: true,
        maxLength: 100,
        pattern: '^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$',
        hint: 'Ejemplo: catalog.read',
      },
      nameField,
      description,
      { key: 'module', label: 'Módulo', required: true, minLength: 2, maxLength: 50 },
    ],
  },
  {
    key: 'products',
    title: 'Prendas',
    singular: 'prenda',
    feminine: true,
    path: `${catalog}/products`,
    group: 'Catálogo',
    permission: 'catalog.read',
    writePermission: 'catalog.write',
    paginated: true,
    softDelete: true,
    states: true,
    search: true,
    columns: [
      { key: 'name', label: 'Prenda' },
      { key: 'category', label: 'Categoría' },
      { key: 'base_price', label: 'Precio (Bs)' },
      { key: 'brand', label: 'Marca' },
    ],
    fields: [
      ...section('Identificación', [
        { ...nameField, maxLength: 180 },
        {
          key: 'slug',
          label: 'Enlace de la prenda',
          maxLength: 200,
          hint: 'Opcional al crear; se genera desde el nombre.',
        },
        { ...description, required: true, minLength: 5 },
      ]),
      ...section('Clasificación', [
        lookup('category_id', 'Categoría', `${catalog}/categories`, true),
        { key: 'brand', label: 'Marca', maxLength: 100 },
        {
          key: 'gender',
          label: 'Público',
          type: 'select',
          options: [
            { value: 'mujer', label: 'Mujer' },
            { value: 'hombre', label: 'Hombre' },
            { value: 'unisex', label: 'Unisex' },
            { value: 'infantil', label: 'Infantil' },
          ],
        },
        lookup('season_id', 'Temporada', `${catalog}/seasons`),
        lookup('collection_id', 'Colección', `${catalog}/collections`),
      ]),
      ...section('Precio y publicación', [
        { key: 'base_price', label: 'Precio base (Bs)', type: 'number', required: true, min: 0 },
        { key: 'is_featured', label: 'Destacar en el catálogo', type: 'checkbox' },
      ]),
    ],
  },
  reference('categories', 'Categorías', 'categoría', [
    { ...nameField, maxLength: 120 },
    { key: 'slug', label: 'Enlace', maxLength: 140 },
    description,
    lookup('parent_id', 'Categoría superior', `${catalog}/categories`),
  ]),
  reference(
    'sizes',
    'Tallas',
    'talla',
    [
      { key: 'code', label: 'Código', required: true, maxLength: 30 },
      { ...nameField, minLength: 1, maxLength: 80 },
      { key: 'sort_order', label: 'Orden', type: 'number', min: 0, default: 0 },
    ],
    [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Nombre' },
      { key: 'sort_order', label: 'Orden' },
    ],
  ),
  reference(
    'colors',
    'Colores',
    'color',
    [
      { ...nameField, maxLength: 80 },
      {
        key: 'hex_code',
        label: 'Color hexadecimal',
        required: true,
        pattern: '^#[0-9A-Fa-f]{6}$',
        default: '#222222',
        hint: 'Seis dígitos, por ejemplo #A87642.',
      },
    ],
    [
      { key: 'name', label: 'Nombre' },
      { key: 'hex_code', label: 'Color' },
    ],
    false,
  ),
  reference(
    'seasons',
    'Temporadas',
    'temporada',
    [
      { ...nameField, maxLength: 120 },
      description,
      { key: 'start_date', label: 'Fecha inicial', type: 'date' },
      { key: 'end_date', label: 'Fecha final', type: 'date' },
    ],
    [
      { key: 'name', label: 'Temporada' },
      { key: 'start_date', label: 'Desde' },
      { key: 'end_date', label: 'Hasta' },
    ],
  ),
  reference(
    'collections',
    'Colecciones',
    'colección',
    [
      { ...nameField, maxLength: 120 },
      description,
      lookup('season_id', 'Temporada', `${catalog}/seasons`),
    ],
    [
      { key: 'name', label: 'Colección' },
      { key: 'season', label: 'Temporada' },
    ],
  ),
];
export const addressesResource: Resource = {
  key: 'addresses',
  title: 'Mis direcciones',
  singular: 'dirección',
  feminine: true,
  path: '/users/me/addresses',
  group: 'Mi cuenta',
  fields: [
    ...section('Destinatario', [
      { key: 'label', label: 'Etiqueta', maxLength: 50, default: 'Casa' },
      { key: 'recipient_name', label: 'Destinatario', required: true, minLength: 2, maxLength: 200 },
      { key: 'phone', label: 'Teléfono', required: true, minLength: 5, maxLength: 30 },
    ]),
    ...section('Dirección de entrega', [
      { key: 'address_line', label: 'Dirección', required: true, minLength: 5, maxLength: 255 },
      { key: 'city', label: 'Ciudad', required: true, minLength: 2, maxLength: 100 },
      { key: 'postal_code', label: 'Código postal', maxLength: 20 },
      {
        key: 'country',
        label: 'País',
        type: 'select',
        default: 'BO',
        options: [{ value: 'BO', label: 'Bolivia' }],
      },
      { key: 'reference', label: 'Referencia', maxLength: 255 },
      {
        key: 'is_default',
        label: 'Usar como dirección predeterminada',
        type: 'checkbox',
        hint: 'La predeterminada se completa sola al finalizar una compra.',
      },
    ]),
  ],
  columns: [
    { key: 'label', label: 'Etiqueta' },
    { key: 'recipient_name', label: 'Destinatario' },
    { key: 'address_line', label: 'Dirección' },
    { key: 'city', label: 'Ciudad' },
    { key: 'postal_code', label: 'Código postal' },
    { key: 'is_default', label: 'Predeterminada' },
  ],
};
