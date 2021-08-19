import { h, render } from "preact";
import { providers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { CORE_CONTRACT_ADDRESS } from "@darkforest_eth/contracts";
import type { DarkForestCore } from "@darkforest_eth/contracts/typechain";
import CORE_CONTRACT_ABI from "@darkforest_eth/contracts/abis/DarkForestCore.json";

import { AppView } from "./views/AppView";

async function getCoreContract(): Promise<DarkForestCore> {
  // @ts-expect-error
  return df.loadContract(CORE_CONTRACT_ADDRESS, CORE_CONTRACT_ABI) as Promise<DarkForestCore>;
}

export default class ProspectPlugin {
  container: HTMLDivElement | null;

  constructor() {
    this.container = null;
  }

  async render(container: HTMLDivElement) {
    this.container = container;
    container.style.width = "500px";
    const contract = await getCoreContract();
    console.log(contract);
    render(<AppView contract={contract} />, container);
  }

  destroy() {
    render(null, this.container);
  }
}
