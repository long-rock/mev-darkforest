import { h } from "preact";
import { useReducer } from "preact/hooks";
import { providers, utils, Wallet } from "ethers";
import type { LocationId } from "@darkforest_eth/types";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

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

  const prospectPlanets = async () => {
    const provider = new providers.JsonRpcProvider({ url: "https://rpc.xdaichain.com/" }, 100);
    const authSigner = Wallet.createRandom();
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      "https://xdai-relay.nethermind.io/"
    );
    // @ts-expect-error
    const privateKey: string = df.getPrivateKey();
    const wallet = new Wallet(privateKey);
    const nonce = await provider.getTransactionCount(wallet.address);
    const transaction = {
      to: wallet.address,
      data: "0x",
      nonce,
      gasPrice: utils.parseUnits("2", "gwei"),
      gasLimit: 21000,
    };
    const signedTransactions = await flashbotsProvider.signBundle([
      {
        signer: wallet,
        transaction,
      },
    ]);
    const targetBlock = (await provider.getBlockNumber()) + 2;
    // simulation not supported yet
    // const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlock);
    const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTransactions, targetBlock);
    const response = await bundleSubmission.wait();
    console.log(response);
  };

  return (
    <div>
      <p>Prospect {state.length} planets</p>
      <div>
        {state.map((locationId: LocationId) => {
          // @ts-expect-error
          const planet = df.getPlanetWithId(locationId);
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
        <button onClick={prospectPlanets}>Prospect!</button>
      </div>
    </div>
  );
}
