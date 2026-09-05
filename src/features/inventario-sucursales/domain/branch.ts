import { Entity } from '../../../shared/models';
export interface Branch extends Entity {
  name: string;
  address: string;
  phone: string | null;
  city: Entity;
  latitude: string | null;
  longitude: string | null;
  opening_hours: Record<string, { open: string; close: string } | null> | null;
}
