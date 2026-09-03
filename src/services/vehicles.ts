/** Trocar corpo por supabase.from('vehicles'). */
import { uuid } from '@/src/lib/uuid';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Vehicle } from '@/src/types/database';

export async function listVehicles(transporterId: string): Promise<Vehicle[]> {
  const db = await loadDb();
  return db.vehicles.filter((v) => v.transporter_id === transporterId);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const db = await loadDb();
  return db.vehicles.find((v) => v.id === id) ?? null;
}

export async function createVehicle(input: {
  transporter_id: string;
  type: string;
  plate: string;
}): Promise<Vehicle> {
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
  await mutateDb((db) => {
    db.vehicles = db.vehicles.filter((v) => v.id !== id);
  });
}
