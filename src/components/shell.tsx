import { COMPANY } from "@/lib/company";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BootSplash } from "@/components/boot-splash";
import { useI18n, type Lang } from "@/lib/i18n";

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <BootSplash />
      <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/brand/logo-mark.jpg" alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-fg object-contain shadow-[0_8px_24px_rgb(0_0_0/0.35)] ring-1 ring-primary/40" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold">MT TRAVEL SERVICE</span>
              <span className="block text-xs text-muted">{t("tagline")}</span>
            </span>
          </Link>
          <div className="flex shrink-0 rounded-full border border-border bg-surface p-1" role="group" aria-label={t("language")}>
            {(["it", "en"] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
                className={`inline-flex h-10 min-w-11 items-center justify-center rounded-full px-3 text-sm font-extrabold ${
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
      <footer className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-8 text-sm text-muted sm:flex sm:items-end sm:justify-between">
        <p>
          {COMPANY.brand} · {t("footer")} · {COMPANY.place}
          <span className="mt-1 block">
            {COMPANY.owner} · P.IVA {COMPANY.vat}
          </span>
        </p>
        <p className="flex gap-4">
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            {t("privacy")}
          </Link>
          <Link to="/richieste" className="underline-offset-2 hover:underline">
            {t("manage")}
          </Link>
        </p>
      </footer>
    </div>
  );
}