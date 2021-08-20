import { ComponentChild, h, JSX } from "preact";
import type { LocationId } from "@darkforest_eth/types";

import { getPlanetName } from "../lib/darkforest";

const labelStyle = {
  textDecoration: "underline",
  flexGrow: "1",
};

interface Props {
  planet: LocationId;
  onClick?: (planet: LocationId) => void;
  addonAfter?: ComponentChild;
}

export function PlanetLabel({ planet, onClick, addonAfter }: Props): JSX.Element {
  const name = getPlanetName(planet);

  const handleClick = () => {
    onClick && onClick(planet);
  };

  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <span onClick={handleClick} style={labelStyle}>
        {name}
      </span>
      {addonAfter}
    </div>
  );
}
