import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Language = {
  code: string;
  label: string;
};

const STORAGE_KEY = "bloxsmith-language";
const TRANSLATE_ELEMENT_ID = "google_translate_element";

const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "zh-CN", label: "Chinese Simplified" },
  { code: "zh-TW", label: "Chinese Traditional" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "tl", label: "Filipino" },
  { code: "th", label: "Thai" },
  { code: "ms", label: "Malay" },
  { code: "bn", label: "Bengali" },
  { code: "ur", label: "Urdu" },
  { code: "fa", label: "Persian" },
  { code: "he", label: "Hebrew" },
  { code: "el", label: "Greek" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "cs", label: "Czech" },
  { code: "ro", label: "Romanian" },
  { code: "hu", label: "Hungarian" },
  { code: "sk", label: "Slovak" },
  { code: "bg", label: "Bulgarian" },
  { code: "hr", label: "Croatian" },
  { code: "sr", label: "Serbian" },
  { code: "sl", label: "Slovenian" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "et", label: "Estonian" },
  { code: "sw", label: "Swahili" },
  { code: "af", label: "Afrikaans" },
];

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

// Google Translate's website widget uses a handful of legacy/non-ISO codes.
// The dropdown option values that Google injects use these codes, so the value
// we feed to the combo (and the googtrans cookie) must match them — otherwise
// the language silently fails to switch. The most common gotcha is Hebrew,
// which Google exposes as "iw" rather than the modern "he".
const GOOGLE_CODE_ALIASES: Record<string, string> = {
  he: "iw",
};

function toGoogleCode(code: string) {
  return GOOGLE_CODE_ALIASES[code] ?? code;
}

// The list Google initializes with must use Google's own codes too.
const INCLUDED_LANGUAGES = LANGUAGES.filter((language) => language.code !== "en")
  .map((language) => toGoogleCode(language.code))
  .join(",");

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

let translateLoader: Promise<void> | null = null;

function getStoredLanguage() {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) || "en";
}

function setTranslateCookie(language: string) {
  const value = `/en/${toGoogleCode(language)}`;
  document.cookie = `googtrans=${value};path=/;SameSite=Lax`;

  if (window.location.hostname.includes(".")) {
    document.cookie = `googtrans=${value};path=/;domain=.${window.location.hostname};SameSite=Lax`;
  }
}

function clearTranslateCookie() {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `googtrans=;expires=${expires};path=/`;

  if (window.location.hostname.includes(".")) {
    document.cookie = `googtrans=;expires=${expires};path=/;domain=.${window.location.hostname}`;
  }
}

function ensureTranslateElement() {
  let mount = document.getElementById(TRANSLATE_ELEMENT_ID);
  if (!mount) {
    mount = document.createElement("div");
    mount.id = TRANSLATE_ELEMENT_ID;
    mount.setAttribute("aria-hidden", "true");
    document.body.appendChild(mount);
  }

  if (!mount.childElementCount && window.google?.translate?.TranslateElement) {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        includedLanguages: INCLUDED_LANGUAGES,
        autoDisplay: false,
      },
      TRANSLATE_ELEMENT_ID,
    );
  }
}

function loadGoogleTranslate() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.translate?.TranslateElement) {
    ensureTranslateElement();
    return Promise.resolve();
  }
  if (translateLoader) return translateLoader;

  translateLoader = new Promise<void>((resolve, reject) => {
    window.googleTranslateElementInit = () => {
      ensureTranslateElement();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="translate.google.com/translate_a/element.js"]',
    );
    if (existing) {
      existing.addEventListener(
        "load",
        () => {
          ensureTranslateElement();
          resolve();
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Translate failed to load")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => reject(new Error("Google Translate failed to load"));
    document.head.appendChild(script);
  });

  return translateLoader;
}

// Prevents an infinite reload loop if Google never exposes a combo option for
// the requested language (e.g. an unsupported code). We allow exactly one
// cookie-based reload attempt per language, tracked for the tab session.
function reloadOnceForLanguage(language: string) {
  try {
    const key = `bloxsmith-translate-reload:${language}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch (_) {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  window.location.reload();
}

function applyGoogleLanguage(language: string, attempts = 0) {
  const googleCode = toGoogleCode(language);
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (combo) {
    combo.value = googleCode;
    combo.dispatchEvent(new Event("change"));
    return;
  }

  if (attempts < 20) {
    window.setTimeout(() => applyGoogleLanguage(language, attempts + 1), 150);
    return;
  }

  // The cookie is already set, so a single reload lets Google apply the
  // translation server-side on the next page load.
  reloadOnceForLanguage(language);
}

const PROTECT_SELECTOR =
  "pre, code, textarea, input, .notranslate, [data-notranslate]";

function protectTechnicalText() {
  document.querySelectorAll<HTMLElement>(PROTECT_SELECTOR).forEach((element) => {
    if (element.getAttribute("translate") === "no") return;
    element.classList.add("notranslate");
    element.setAttribute("translate", "no");
  });
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  // Start at the SSR-safe default ("en") and read the stored language in
  // an effect. Reading localStorage in a lazy state initializer caused
  // React error #419 (hydration mismatch) for any user who had previously
  // picked a non-English language — the server-rendered HTML said "en" but
  // the client immediately re-rendered with the stored value.
  const [language, setLanguage] = useState("en");

  // Holds the active DOM observer so we only ever run one and can tear it
  // down the moment the user returns to English.
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  const languageLabel = useMemo(
    () => LANGUAGES.find((item) => item.code === language)?.label ?? "Language",
    [language],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  }, [language]);

  // Single effect that owns translation + the technical-text protector.
  //
  // Previously a MutationObserver watched the entire <body> for *every* user,
  // English included, and ran a full-document querySelectorAll synchronously on
  // every DOM mutation. On streaming pages (the AI builder) that fired hundreds
  // of times per second and was the main source of the reported lag.
  //
  // Now: English users get no observer and no scanning at all. When a language
  // is active, the protector runs once up front and afterwards only via a
  // coalesced, idle-time observer so bursts of mutations collapse into a single
  // scan instead of one scan per mutation.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tear down any previous observer before reconfiguring.
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (language === "en") {
      clearTranslateCookie();
      return;
    }

    let scheduled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const runProtect = () => {
      scheduled = false;
      idleHandle = null;
      timeoutHandle = null;
      protectTechnicalText();
    };

    // Coalesce a burst of mutations into one scan during idle time, with a
    // timeout fallback so it still runs even when the page never goes idle
    // (e.g. continuous token streaming).
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (ric) {
        idleHandle = ric(runProtect, { timeout: 500 });
      } else {
        timeoutHandle = window.setTimeout(runProtect, 300);
      }
    };

    // Initial pass so existing technical text is protected immediately.
    protectTechnicalText();
    setTranslateCookie(language);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    loadGoogleTranslate()
      .then(() => applyGoogleLanguage(language))
      .catch(() => {
        reloadOnceForLanguage(language);
      });

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (idleHandle != null && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [language]);

  const handleChange = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);

    if (nextLanguage === "en") {
      clearTranslateCookie();
      // Google Translate cannot fully revert an in-place translation, so a
      // reload is required to return to the original English DOM.
      window.location.reload();
      return;
    }

    // The language effect above handles cookie + load + apply for the new
    // language once state updates; nothing else needed here.
  };

  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface/70 px-2.5 py-2 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-surface",
        compact && "w-full",
      )}
      title={`Language: ${languageLabel}`}
    >
      <Globe2 className="h-4 w-4 shrink-0 text-primary-glow" />
      <span className="sr-only">Language</span>
      <select
        value={language}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          "min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium outline-none",
          compact ? "w-full" : "w-[9.75rem]",
        )}
        aria-label="Choose website language"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code} className="bg-background text-foreground">
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </label>
  );
}
