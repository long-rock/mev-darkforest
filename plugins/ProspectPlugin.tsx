import { h, JSX, render } from "preact";

import { ProspectView } from "./views/ProspectView";

export default class ProspectPlugin {
  container: HTMLDivElement | null;

  constructor() {
    this.container = null;
  }

  async render(container: HTMLDivElement): Promise<void> {
    this.container = container;
    container.style.width = "500px";
    render(<ProspectView />, container);
  }

  destroy(): void {
    if (this.container) {
      render(null, this.container);
    }
  }
}
