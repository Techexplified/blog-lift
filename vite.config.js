import { applyShopifyPartnerEnv } from "./scripts/apply-shopify-partner-env.mjs";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

applyShopifyPartnerEnv();

// Shopify CLI sets `HOST` to the public dev URL (e.g. Cloudflare tunnel). That must become
// `SHOPIFY_APP_URL` so OAuth + Vite `allowedHosts` / HMR match the hostname you open in the browser.
// (If we only replaced when SHOPIFY_APP_URL was empty, `.env` tunnel runs would keep `localhost` and tunnels got blocked.)
if (process.env.HOST) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;
let hmrConfig;

if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    // Bind IPv4 + IPv6 so http://127.0.0.1:PORT works on Windows ( [::1]-only breaks some setups )
    host: true,
    // Tunnels get a new hostname often; allow any host in dev to avoid "Blocked request" overlays.
    allowedHosts: true,
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    strictPort: true,
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [reactRouter(), tsconfigPaths(), tailwindcss()],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
});
