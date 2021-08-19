import { h } from "preact";
import { useReducer } from "preact/hooks";
import { providers, utils, Wallet } from "ethers";
import {} from "@darkforest_eth/constants";
import type { LocationId } from "@darkforest_eth/types";
import type { DarkForestCore } from "@darkforest_eth/contracts/typechain";
import { NETWORK_ID } from "@darkforest_eth/contracts";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";

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

export function AppView({ contract }: { contract: DarkForestCore }) {
  const [state, dispatch] = useReducer(stateReducer, []);

  const addPlanet = () => {
    // @ts-expect-error
    const planet = ui.getSelectedPlanet();
    if (planet && !state.includes(planet.locationId)) {
      dispatch({ type: "add_planet", payload: planet.locationId });
    }
  };

  const prospectPlanets = async () => {
    const provider = new providers.JsonRpcProvider({ url: "https://rpc-df.xdaichain.com/" }, NETWORK_ID);
    const authSigner = Wallet.createRandom();
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      "https://xdai-relay.nethermind.io/"
    );
    // @ts-expect-error
    const privateKey: string = df.getPrivateKey();
    const wallet = new Wallet(privateKey, provider);
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Wallet: ${wallet.address}`);
    const bundle = [];
    for (let i = 0; i < state.length; i++) {
      const tx = await contract.connect(wallet).populateTransaction.prospectPlanet("0x" + state[i]);
      const gasLimit = await provider.estimateGas(tx);
      const transaction = {
        to: contract.address,
        data: tx.data,
        chainId: NETWORK_ID,
        nonce: nonce + i,
        gasPrice: utils.parseUnits("4", "gwei"),
        gasLimit,
      };
      console.log(`Tx ${i}`, transaction);
      bundle.push({ transaction, signer: wallet });
    }
    const signedTransactions = await flashbotsProvider.signBundle(bundle);
    const currentBlock = await provider.getBlockNumber();
    const submissions = [];
    const minBlock = 2;
    const numBlocks = 20;
    for (let i = minBlock; i < minBlock + numBlocks; i++) {
      const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTransactions, currentBlock + i);
      console.log(`Submitted bundle with target ${currentBlock + i} `, bundleSubmission);
      submissions.push(bundleSubmission);
    }

    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      const response = await sub.wait();
      console.log(`Response ${FlashbotsBundleResolution[response]}`);
      if (response === FlashbotsBundleResolution.BundleIncluded) {
        break;
      }
    }

    state.forEach((locationId) => {
      console.log(`Refresh planet ${locationId}`);
      // @ts-expect-error
      df.softRefreshPlanet(locationId);
    });
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
