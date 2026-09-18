import { Resource } from '../../../shared/form-schema';
import { lookup, nameField, section } from '../../usuarios-catalogo/application/resources';
const base = '/organization';
export const organizationResources: Resource[] = [
  {
    key: 'suppliers',
    title: 'Proveedores',
    singular: 'proveedor',
    path: `${base}/suppliers`,
    group: 'Organización',
    permission: 'suppliers.read',
    writePermission: 'suppliers.write',
    states: true,
    softDelete: true,
    search: true,
    columns: [
      { key: 'business_name', label: 'Razón social' },
      { key: 'tax_id', label: 'NIT' },
      { key: 'contact_name', label: 'Contacto' },
      { key: 'phone', label: 'Teléfono' },
    ],
    fields: [
      ...section('Empresa', [
        {
          key: 'business_name',
          label: 'Razón social',
          required: true,
          minLength: 2,
          maxLength: 180,
        },
        { key: 'trade_name', label: 'Nombre comercial', maxLength: 180 },
        { key: 'tax_id', label: 'NIT', required: true, minLength: 3, maxLength: 50 },
      ]),
      ...section('Contacto', [
        { key: 'contact_name', label: 'Persona de contacto', maxLength: 150 },
        { key: 'email', label: 'Correo', type: 'email' },
        { key: 'phone', label: 'Teléfono', maxLength: 30 },
      ]),
      ...section('Ubicación y notas', [
        { key: 'address', label: 'Dirección', maxLength: 255 },
        { key: 'city', label: 'Ciudad', maxLength: 100 },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]),
    ],
  },
  {
    key: 'cities',
    title: 'Ciudades',
    singular: 'ciudad',
    feminine: true,
    path: `${base}/cities`,
    group: 'Organización',
    permission: 'branches.read',
    writePermission: 'branches.write',
    states: true,
    columns: [
      { key: 'name', label: 'Ciudad' },
      { key: 'department', label: 'Departamento' },
      { key: 'country', label: 'País' },
    ],
    fields: [
      nameField,
      { ...nameField, key: 'department', label: 'Departamento' },
      { ...nameField, key: 'country', label: 'País', default: 'Bolivia' },
    ],
  },
  {
    key: 'branches',
    title: 'Sucursales',
    singular: 'sucursal',
    feminine: true,
    path: `${base}/branches`,
    group: 'Organización',
    permission: 'branches.read',
    writePermission: 'branches.write',
    states: true,
    softDelete: true,
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Sucursal' },
      { key: 'city', label: 'Ciudad' },
      { key: 'address', label: 'Dirección' },
    ],
    fields: [
      ...section('Identificación', [
        { key: 'code', label: 'Código', required: true, minLength: 2, maxLength: 30 },
        { ...nameField, maxLength: 150 },
        lookup('city_id', 'Ciudad', `${base}/cities`, true),
      ]),
      ...section('Ubicación y contacto', [
        { key: 'address', label: 'Dirección', required: true, minLength: 5, maxLength: 255 },
        { key: 'phone', label: 'Teléfono', maxLength: 30 },
        // Casilla que recibe los avisos de reserva de esta sucursal (RF11).
        { key: 'notification_email', label: 'Correo para avisos de reserva', type: 'email', maxLength: 320 },
        { key: 'latitude', label: 'Latitud', type: 'number', min: -90, max: 90 },
        { key: 'longitude', label: 'Longitud', type: 'number', min: -180, max: 180 },
      ]),
      ...section('Horarios', [
        { key: 'opening_hours', label: 'Horarios de atención', type: 'hours' },
      ]),
    ],
  },
  {
    key: 'cash-points',
    title: 'Cajas',
    singular: 'caja',
    feminine: true,
    path: `${base}/cash-points`,
    group: 'Organización',
    permission: 'branches.read',
    writePermission: 'branches.write',
    states: true,
    softDelete: true,
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Caja' },
      { key: 'branch_id', label: 'Sucursal' },
    ],
    fields: [
      lookup('branch_id', 'Sucursal', `${base}/branches`, true),
      { key: 'code', label: 'Código', required: true, maxLength: 30 },
      nameField,
    ],
  },
];
