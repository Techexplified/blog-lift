import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import "./global.css";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <Outlet />
          <div className="fixed top-[76px] right-4 z-[9999] pointer-events-auto">
            <ThemeToggle />
          </div>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const handle = {
  hydrate: true,
};
