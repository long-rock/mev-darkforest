import { h, JSX } from "preact";
import { useEffect, useState, useLayoutEffect, useReducer, useCallback } from "preact/hooks";
import type { LocationId } from "@darkforest_eth/types";

import { useCoreContract, usePlanetName, useSelectedPlanet } from "../lib/darkforest";
import { useFlashbotsBundle, useWallet } from "../lib/flashbots";

import { FlashbotsStatus } from "../components/FlashbotsStatus";
import { PlanetLabel } from "../components/PlanetLabel";

const descriptionStyle = {
  fontStyle: "italic",
};

const planetListStyle = {
  marginBottom: "15px",
  marginTop: "5px",
};

const actionContainerStyle = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
};

interface AddPlanet {
  type: "add_planet";
  payload: LocationId;
}

interface RemovePlanet {
  type: "remove_planet";
  payload: LocationId;
}

type Action = AddPlanet | RemovePlanet;

interface State {
  planets: LocationId[];
}

function stateReducer(state: State, action: Action): State {
  switch (action.type) {
    case "add_planet": {
      if (state.planets.includes(action.payload)) {
        return state;
      }
      const newPlanets = [...state.planets, action.payload];
      return { ...state, planets: newPlanets };
    }
    case "remove_planet": {
      const newPlanets = state.planets.filter((p) => p !== action.payload);
      return { ...state, planets: newPlanets };
    }
    default:
      return state;
  }
}

export function ProspectView(): JSX.Element {
  const [state, dispatch] = useReducer(stateReducer, { planets: [] });
  const contract = useCoreContract();
  const selectedPlanet = useSelectedPlanet();
  const selectedPlanetName = usePlanetName(selectedPlanet);

  const wallet = useWallet();

  const refreshPlanets = useCallback(() => {
    state.planets.forEach((locationId) => {
      console.log(`Refresh planet ${locationId}`);
      // @ts-expect-error
      df.softRefreshPlanet(locationId);
    });
  }, [state]);

  const {
    submitBundle,
    clear,
    bundles,
    completed,
    submitting,
    error: flashbotsError,
  } = useFlashbotsBundle({ onComplete: refreshPlanets });

  const addSelectedPlanet = () => {
    if (!selectedPlanet) {
      return;
    }
    dispatch({ type: "add_planet", payload: selectedPlanet });
  };

  const removePlanet = (locationId: LocationId) => {
    dispatch({ type: "remove_planet", payload: locationId });
  };

  const centerOnPlanet = (locationId: LocationId) => {
    // @ts-expect-error
    ui.centerLocationId(locationId);
  };

  const submitProspectBundle = async () => {
    if (!contract) return;
    const transactions = [];
    for (let i = 0; i < state.planets.length; i++) {
      const tx = await contract.connect(wallet).populateTransaction.prospectPlanet("0x" + state.planets[i]);
      transactions.push({
        to: contract.address,
        transaction: tx,
      });
    }
    submitBundle(transactions);
  };

  let actionButtonText = "";
  if (selectedPlanet && selectedPlanetName) {
    if (state.planets.includes(selectedPlanet)) {
      actionButtonText = "Select different planet";
    } else {
      actionButtonText = `Add ${selectedPlanetName}`;
    }
  } else {
    actionButtonText = "Select planet";
  }

  let content;
  if (flashbotsError) {
    content = (
      <div>
        <div>
          <span style={descriptionStyle}>Something went wrong submitting the bundle.</span>
        </div>
        <div>{flashbotsError}</div>
        <div>
          <button onClick={clear}>Go back</button>
        </div>
      </div>
    );
  } else if (submitting) {
    content = (
      <div>
        <div>
          <span style={descriptionStyle}>Submitting bundle to flashbots.</span>
        </div>
        {bundles.map((result, idx) => (
          <FlashbotsStatus key={idx} status={result} />
        ))}
        <div>{completed && <button onClick={clear}>Go back</button>}</div>
      </div>
    );
  } else {
    content = (
      <div>
        <div>
          <span style={descriptionStyle}>Prospect multiple planets in a single block.</span>
        </div>
        <div style={planetListStyle}>
          {state.planets.map((locationId) => (
            <PlanetLabel
              planet={locationId}
              onClick={centerOnPlanet}
              addonAfter={
                <span onClick={() => removePlanet(locationId)} style={{ cursor: "pointer" }}>
                  X
                </span>
              }
            />
          ))}
        </div>
        <div style={actionContainerStyle}>
          <button disabled={!selectedPlanet} onClick={addSelectedPlanet}>
            {actionButtonText}
          </button>
          <button disabled={state.planets.length === 0} onClick={submitProspectBundle}>
            Prospect
          </button>
        </div>
      </div>
    );
  }
  return content;
}
