import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n, type Lang } from "@/lib/i18n";

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/brand/logo-mark.jpg" alt="" className="h-16 w-16 shrink-0 rounded-md bg-fg object-contain" />
            <span className="min-w-0 leading-tight">
              <span className="block text-xs font-extrabold tracking-wide sm:text-sm">MT TRAVEL SERVICE</span>
              <span className="block text-xs font-semibold tracking-wide text-muted">{t("tagline")}</span>
            </span>
          </Link>
          <div className="flex shrink-0 rounded-md border border-border p-1" role="group" aria-label={t("language")}>
            {(["it", "en"] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
                className={`inline-flex h-11 min-w-11 items-center justify-center rounded px-3 text-sm font-extrabold ${
                  lang === code ? "bg-primary text-primary-fg" : "text-fg"
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-8 text-sm text-muted">
        <p>MT TRAVEL SERVICE · {t("footer")} · Gambettola (FC)</p>
        <Link to="/richieste" className="shrink-0 underline-offset-2 hover:underline">
          {t("manage")}
        </Link>
      </footer>
    </div>
  );
}