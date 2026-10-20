"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addVehicleToGarage, chooseGarageVersion, fetchMyGarage, removeVehicleFromGarage, setDefaultVehicle, type GarageVehicle } from "@/lib/api";
import { defaultVehicle as pickDefault } from "@/lib/garage";
import { getAuthToken, useAuth } from "./AuthProvider";

interface GarageValue {
  vehicles: GarageVehicle[];
  /** The car that drives "Shopping for" and "Fits my car" (null when signed out or nothing saved). */
  defaultVehicle: GarageVehicle | null;
  signedIn: boolean;
  loading: boolean;
  /** Saves a car: its year and, when the year has versions, its version (the server asks for it). */
  add: (generationId: string, year: number, versionId?: string) => Promise<void>;
  /** Removing and choosing the default act on THAT car: two versions of one year are two cars. */
  remove: (v: Pick<GarageVehicle, "generationId" | "year" | "versionId">) => Promise<void>;
  makeDefault: (v: Pick<GarageVehicle, "generationId" | "year" | "versionId">) => Promise<void>;
  /** Gives a car saved before versions existed (a car with no version) its version. */
  chooseVersion: (v: Pick<GarageVehicle, "generationId" | "year">, versionId: string) => Promise<void>;
}

const GarageContext = createContext<GarageValue>({ vehicles: [], defaultVehicle: null, signedIn: false, loading: false, add: async () => {}, remove: async () => {}, makeDefault: async () => {}, chooseVersion: async () => {} });

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
      add: (generationId, year, versionId) => withToken((t) => addVehicleToGarage(t, generationId, year, versionId)),
      remove: (v) => withToken((t) => removeVehicleFromGarage(t, v.generationId, v.year, v.versionId)),
      makeDefault: (v) => withToken((t) => setDefaultVehicle(t, v.generationId, v.year, v.versionId)),
      chooseVersion: (v, versionId) => withToken((t) => chooseGarageVersion(t, v.generationId, v.year, versionId)),
    };
  }, [userId, loaded, refresh]);

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export const useGarage = (): GarageValue => useContext(GarageContext);
