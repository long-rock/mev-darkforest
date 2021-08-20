import { useState, useEffect } from "preact/hooks";
import type { LocationId, Planet } from "@darkforest_eth/types";
import { CORE_CONTRACT_ADDRESS } from "@darkforest_eth/contracts";
import type { DarkForestCore } from "@darkforest_eth/contracts/typechain";
import CORE_CONTRACT_ABI from "@darkforest_eth/contracts/abis/DarkForestCore.json";

// @ts-expect-error
const pg = df.getProcgenUtils();

export function getPlanetName(locationId: LocationId): string {
  // @ts-expect-error
  const planet = df.getPlanetWithId(locationId);
  return pg.getPlanetName(planet);
}

export async function getCoreContract(): Promise<DarkForestCore> {
  // @ts-expect-error
  return df.loadContract(CORE_CONTRACT_ADDRESS, CORE_CONTRACT_ABI) as Promise<DarkForestCore>;
}

export function useCoreContract(): DarkForestCore | undefined {
  const [contract, setContract] = useState<DarkForestCore | undefined>(undefined);
  useEffect(() => {
    getCoreContract().then((c) => {
      console.log("got contract", c);
      setContract(c);
    });
  }, []);
  return contract;
}

export function useSelectedPlanet(): LocationId | undefined {
  const [selected, setSelected] = useState<LocationId | undefined>(undefined);
  useEffect(() => {
    // @ts-expect-error
    const { unsubscribe } = ui.selectedPlanetId$.subscribe(setSelected);
    return () => {
      unsubscribe();
    };
  });
  return selected;
}

export function usePlanet(locationId: LocationId | undefined): Planet | undefined {
  const [planet, setPlanet] = useState<Planet | undefined>(undefined);
  useEffect(() => {
    if (locationId) {
      // @ts-expect-error
      const planet_ = df.getPlanetWithId(locationId);
      return setPlanet(planet_);
    }
    return setPlanet(undefined);
  }, [locationId]);
  return planet;
}

export function usePlanetName(locationId: LocationId | undefined): string | undefined {
  const planet = usePlanet(locationId);
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (planet) {
      const name_ = pg.getPlanetName(planet);
      return setName(name_);
    }
    return setName(undefined);
  }, [planet]);
  return name;
}
