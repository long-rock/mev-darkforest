import { h } from "preact";
import { useReducer } from "preact/hooks";
import type { LocationId } from "@darkforest_eth/types";

// @ts-expect-error
const pg = df.getProcgenUtils();

interface AddPlanet {
  type: "add_planet";
  payload: LocationId;
}

interface RemovePlanet {
  type: "remove_planet";
  payload: LocationId;
}

type Action = AddPlanet | RemovePlanet;

type State = LocationId[];

function stateReducer(state: State, action: Action): State {
  switch (action.type) {
    case "add_planet":
      return [...state, action.payload];
    case "remove_planet":
      return state.filter((p) => p !== action.payload);
    default:
      return state;
  }
}

export function AppView() {
  const [state, dispatch] = useReducer(stateReducer, []);

  const addPlanet = () => {
    // @ts-expect-error
    const planet = ui.getSelectedPlanet();
    if (planet && !state.includes(planet.locationId)) {
      dispatch({ type: "add_planet", payload: planet.locationId });
    }
  };

  return (
    <div>
      <p>Prospect {state.length} planets</p>
      <div>
        {state.map((locationId: LocationId) => {
          // @ts-expect-error
          const planet = df.getPlanetWithId(locationId);
          // @ts-expect-error
          const name = pg.getPlanetName(planet);
          const centerLocation = () => {
            // @ts-expect-error
            ui.centerLocationId(locationId);
          };
          return (
            <p key={locationId} onClick={centerLocation}>
              {name}
            </p>
          );
        })}
      </div>
      <div>
        <button onClick={addPlanet}>Add planet</button>
        <button>Prospect!</button>
      </div>
    </div>
  );
}
