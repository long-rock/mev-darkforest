# MEV-powered plugins for Dark Forest

This repository contains plugins that use the Flashbots API
to submit transaction without going through the public mempool.

## Plugins

 * `ProspectPlugin`: prospect multiple foundries in the same block.
    Artifacts quality is dependant on the hash of the block they were
    prospected in. With this plugin, all artifacts will have the same
    quality.

## Getting Started

 * Install dependencies with `npm install`
 * Start development server with `npm run serve`
 * Create a new plugin in the game with the following line of code: `export { default } from "http://127.0.0.1:2222/ProspectPlugin.js?dev";`

 ## License

 Licensed under the GNU General Public License, Version 3.