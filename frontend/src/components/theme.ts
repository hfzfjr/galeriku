export const THEME_STORAGE_KEY = "galeriku-theme";

export type ThemeChoice = "light" | "dark" | "auto";

/**
 * Skrip inline yang berjalan sebelum paint untuk mencegah kilatan tema
 * yang salah. Membaca pilihan tersimpan dan memasang/menghapus
 * atribut data-theme di <html>. Otomatis = atribut dihapus (CSS
 * mengikuti prefers-color-scheme). Aman bila localStorage tidak ada.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}else{document.documentElement.removeAttribute("data-theme")}}catch(e){document.documentElement.removeAttribute("data-theme")}})();`;

export function readStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "auto") {
      return value;
    }
  } catch {
    // localStorage tidak tersedia — pakai Otomatis.
  }
  return "auto";
}

export function applyThemeChoice(choice: ThemeChoice): void {
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function storeThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Penyimpanan tidak tersedia — tema tetap berlaku sesi ini saja.
  }
}
