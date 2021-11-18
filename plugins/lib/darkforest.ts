import { useState, useEffect } from "preact/hooks";
import type { LocationId, Planet } from "@darkforest_eth/types";
import { CORE_CONTRACT_ADDRESS } from "@darkforest_eth/contracts";
import type { DarkForestCore } from "@darkforest_eth/contracts/typechain";
import CORE_CONTRACT_ABI from "@darkforest_eth/contracts/abis/DarkForestCore.json";
import * as CONSTANTS from '@darkforest_eth/constants';

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



export async function capturePlanets(fromId, minCaptureLevel=0, maxCaptureLevel=9, maxDistributeEnergyPercent=75, planetType=0, minimumEnergyAllowed = 0, coreContract) {
  let movesToMake = [];
  const planet = df.getPlanetWithId(fromId);
  const from = df.getPlanetWithId(fromId);

  // Rejected if has pending outbound moves
  const unconfirmed = df.getUnconfirmedMoves().filter(move => move.from === fromId)
  if (unconfirmed.length !== 0) {
      return [];
  }

  const candidates_ = df.getPlanetsInRange(fromId, maxDistributeEnergyPercent)
      .filter(p => (
          p.owner !== df.account &&
          p.planetLevel >= minCaptureLevel &&
          p.planetLevel <= maxCaptureLevel &&
          p.planetType === planetType
      ))
      .map(to => {
          return [to, distance(from, to)]
      })
      .sort((a, b) => a[1] - b[1]);

  let i = 0;
  const energyBudget = Math.floor((maxDistributeEnergyPercent / 100) * planet.energy);

  let energySpent = 0;
  let moves = 0;
  while (energyBudget - energySpent > 0 && i < candidates_.length) {

      const energyLeft = energyBudget - energySpent;

      // Remember its a tuple of candidates and their distance
      const candidate = candidates_[i++][0];
      // Rejected if has unconfirmed pending arrivals
      const unconfirmed = df.getUnconfirmedMoves().filter(move => move.to === candidate.locationId)
      if (unconfirmed.length !== 0) {
          continue;
      }

      // Rejected if has pending arrivals
      const arrivals = getArrivalsForPlanet(candidate.locationId);
      if (arrivals.length !== 0) {
          continue;
      }

      // set minimum above energy to % or 1 (if 0%), depending on minimumEnergyAllowed value
      const energyForCandidate = minimumEnergyAllowed === 0 ? 1 : candidate.energyCap * minimumEnergyAllowed / 100
      const energyArriving = energyForCandidate + (candidate.energy * (candidate.defense / 100));
      // needs to be a whole number for the contract
      const energyNeeded = Math.ceil(df.getEnergyNeededForMove(fromId, candidate.locationId, energyArriving));
      if (energyLeft - energyNeeded < 0) {
          continue;
      }
      const silver = candidate.silver;
      const moveTx = await move(from,candidate,energyNeeded,silver,0,coreContract);
      movesToMake.push(moveTx);
      // df.move(fromId, candidate.locationId, energyNeeded, 0);
      energySpent += energyNeeded;
      moves += 1;
  }

  df.terminal.current.println(`making ${moves} moves...`)

  return movesToMake;
}

function getArrivalsForPlanet(planetId) {
  return df.getAllVoyages().filter(arrival => arrival.toPlanet === planetId).filter(p => p.arrivalTime > Date.now() / 1000);
}

//returns tuples of [planet,distance]
function distance(from, to) {
  let fromloc = from.location;
  let toloc = to.location;
  return Math.sqrt((fromloc.coords.x - toloc.coords.x) ** 2 + (fromloc.coords.y - toloc.coords.y) ** 2);
}

export async function move(from: Planet, to: Planet, forces: number, silver: number, artifactId: number, darkForestCore: DarkForestCore): Promise<PopulatedTransaction> {
  // we need to know the zksnark constants to do a move
  console.log(from, to);
  const oldX = from.location.coords.x;
  const oldY = from.location.coords.y;
  const newX = to.location.coords.x;
  const newY = to.location.coords.y;
  const xDiff = newX - oldX;
  const yDiff = newY - oldY;

  const distMax = Math.ceil(Math.sqrt(xDiff ** 2 + yDiff ** 2));
  
  const worldRadius = (await darkForestCore.worldRadius()).toNumber();
  
  // @ts-expect-error
  const moveArgs = await df.snarkHelper.getMoveArgs(oldX, oldY, newX, newY, worldRadius, distMax);
  const handleMoveArgs = async (callArgs: any): Promise<PopulatedTransaction> => {
      console.log(`somegoddam callArgs`, callArgs);
  
      const proofA = callArgs[0];
      const proofB = callArgs[1];
      const proofC = callArgs[2];
      const input = [
        ...callArgs[3],
        (forces * CONSTANTS.CONTRACT_PRECISION).toString(),
        (silver * CONSTANTS.CONTRACT_PRECISION).toString(),
        '0' // will need to update for artifacts later.
      ];      
 
      // @ts-expect-error
      const tx = await darkForestCore.populateTransaction.move(proofA, proofB, proofC, input);
      // const moveReceipt = await df.contractsAPI.move(actionId, callArgs, forces, silver, artifactId);
      console.log(`MoveReceipt`, tx)
      return tx;
  };

  return handleMoveArgs(moveArgs);
}