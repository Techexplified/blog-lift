import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("bloglift-theme") || "light";
    setTheme(savedTheme);
    applyTheme(savedTheme);
    console.log("ThemeProvider: Initial theme set to", savedTheme);
  }, []);

  const applyTheme = (t) => {
    const isDark = t === "dark";
    // Apply to both html and body for maximum compatibility
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
    
    // Also use a data attribute which can be more reliable in some environments
    document.documentElement.setAttribute("data-theme", t);
    document.body.setAttribute("data-theme", t);
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    console.log("ThemeProvider: Toggling theme from", theme, "to", newTheme);
    setTheme(newTheme);
    localStorage.setItem("bloglift-theme", newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
