"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addVehicleToGarage, fetchMyGarage, removeVehicleFromGarage, setDefaultVehicle, type GarageVehicle } from "@/lib/api";
import { defaultVehicle as pickDefault } from "@/lib/garage";
import { getAuthToken, useAuth } from "./AuthProvider";

interface GarageValue {
  vehicles: GarageVehicle[];
  /** The car that drives "Shopping for" and "Fits my car" (null when signed out or nothing saved). */
  defaultVehicle: GarageVehicle | null;
  signedIn: boolean;
  loading: boolean;
  add: (generationId: string, year: number) => Promise<void>;
  remove: (v: Pick<GarageVehicle, "generationId" | "year">) => Promise<void>;
  makeDefault: (v: Pick<GarageVehicle, "generationId" | "year">) => Promise<void>;
}

const GarageContext = createContext<GarageValue>({ vehicles: [], defaultVehicle: null, signedIn: false, loading: false, add: async () => {}, remove: async () => {}, makeDefault: async () => {} });

/** The signed-in buyer's saved cars (the same garage the mobile app shows), loaded once and kept in step with every change made here. */
export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // The list belongs to ONE buyer: when somebody else signs in, the old list is simply not theirs (derived below, never reset in an effect).
  const [loaded, setLoaded] = useState<{ userId: string; vehicles: GarageVehicle[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyGarage(token)
      .then((vehicles) => { if (current) setLoaded({ userId, vehicles }); })
      .catch(() => { if (current) setLoaded({ userId, vehicles: [] }); });
    return () => { current = false; };
  }, [userId]);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !userId) return;
    setLoaded({ userId, vehicles: await fetchMyGarage(token) });
  }, [userId]);

  const value = useMemo<GarageValue>(() => {
    const vehicles = userId && loaded?.userId === userId ? loaded.vehicles : [];
    const withToken = async (action: (token: string) => Promise<unknown>) => {
      const token = getAuthToken();
      if (!token) throw new Error("Not signed in");
      await action(token);
      await refresh();
    };
    return {
      vehicles,
      defaultVehicle: pickDefault(vehicles),
      signedIn: !!userId,
      loading: !!userId && loaded?.userId !== userId,
      add: (generationId, year) => withToken((t) => addVehicleToGarage(t, generationId, year)),
      remove: (v) => withToken((t) => removeVehicleFromGarage(t, v.generationId, v.year)),
      makeDefault: (v) => withToken((t) => setDefaultVehicle(t, v.generationId, v.year)),
    };
  }, [userId, loaded, refresh]);

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export const useGarage = (): GarageValue => useContext(GarageContext);
