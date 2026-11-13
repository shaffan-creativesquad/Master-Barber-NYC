import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Keep RPC transformation out of unit tests so mocked server boundaries execute handlers.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node" },
});