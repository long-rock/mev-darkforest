import { h, JSX, render } from "preact";

import { MoveView } from "./views/MoveView";

export default class MovePlugin {
  container: HTMLDivElement | null;

  constructor() {
    this.container = null;
  }

  async render(container: HTMLDivElement): Promise<void> {
    this.container = container;
    container.style.width = "500px";
    render(<MoveView />, container);
  }

  destroy(): void {
    if (this.container) {
      render(null, this.container);
    }
  }
}
