import { defineConfig } from 'tsup'

export default defineConfig({
  target: 'node22',
  // node:sqlite only exists with its node: prefix.
  removeNodeProtocol: false,
})
