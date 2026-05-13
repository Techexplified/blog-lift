import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={() => {
        console.log("ThemeToggle: Button clicked");
        toggleTheme();
      }}
      className="relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 bg-white dark:bg-slate-800 shadow-lg dark:shadow-slate-900/20 border border-slate-200 dark:border-slate-700 group overflow-hidden"
      aria-label="Toggle theme"
    >
      <div className="relative w-6 h-6 flex items-center justify-center">
        {/* Sun Icon */}
        <div
          className={`absolute transition-all duration-500 transform ${
            theme === "dark"
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        >
          <Sun className="w-6 h-6 text-amber-500 fill-amber-50" />
        </div>

        {/* Moon Icon */}
        <div
          className={`absolute transition-all duration-500 transform ${
            theme === "light"
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        >
          <Moon className="w-6 h-6 text-blue-400 fill-blue-50" />
        </div>
      </div>
      
      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-tr from-[#17a5b4] to-transparent" />
    </button>
  );
}
