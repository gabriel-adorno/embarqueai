/** Trocar corpo por supabase.from('vehicles'). */
import { isRemote } from '@/src/lib/config';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Vehicle } from '@/src/types/database';

export async function listVehicles(transporterId: string): Promise<Vehicle[]> {
  if (isRemote()) return remote.listVehicles(transporterId);
  const db = await loadDb();
  return db.vehicles.filter((v) => v.transporter_id === transporterId);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  if (isRemote()) return remote.getVehicle(id);
  const db = await loadDb();
  return db.vehicles.find((v) => v.id === id) ?? null;
}

export async function createVehicle(input: {
  transporter_id: string;
  type: string;
  plate: string;
}): Promise<Vehicle> {
  if (isRemote()) return remote.createVehicle(input);
  const vehicle: Vehicle = {
    id: uuid(),
    transporter_id: input.transporter_id,
    type: input.type,
    plate: input.plate.toUpperCase(),
  };
  await mutateDb((db) => {
    db.vehicles.push(vehicle);
  });
  return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  if (isRemote()) return remote.deleteVehicle(id);
  await mutateDb((db) => {
    db.vehicles = db.vehicles.filter((v) => v.id !== id);
  });
}
