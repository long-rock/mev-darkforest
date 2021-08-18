import { h, render } from "preact";
import { providers, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

import { AppView } from "./views/AppView";

export default class ProspectPlugin {
  container: HTMLDivElement | null;

  constructor() {
    this.container = null;
  }

  async render(container: HTMLDivElement) {
    this.container = container;
    container.style.width = "500px";
    render(<AppView />, container);
  }

  destroy() {
    render(null, this.container);
  }
}
