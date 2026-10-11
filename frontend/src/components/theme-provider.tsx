"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemeChoice,
  readStoredTheme,
  storeThemeChoice,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "./theme";

type ThemeContextValue = {
  theme: ThemeChoice;
  setTheme: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "auto",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("auto");

  // Samakan state dengan pilihan tersimpan setelah mount.
  // Skrip inline di layout sudah memasang data-theme sebelum paint,
  // jadi tidak ada kilatan walau state awal "auto". Pembacaan
  // ditunda ke callback agar render pertama klien sama dengan SSR
  // (tidak ada hydration mismatch) dan lolos aturan set-state-in-effect.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = readStoredTheme();
      setThemeState(stored);
      applyThemeChoice(stored);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const next = readStoredTheme();
        setThemeState(next);
        applyThemeChoice(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeState(choice);
    storeThemeChoice(choice);
    applyThemeChoice(choice);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
