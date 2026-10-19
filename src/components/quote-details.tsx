import { PaymentChoice } from "@/components/payment-marks";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/bookings";
import { customerPrice, euro, formatDuration, kmLabel, legMeasure, priceMarked } from "@/lib/format";
import { priceSplit, type Quote } from "@/lib/tariff";

export function PriceSummary({ total, passengers, marked = false }: { total: number; passengers: number; marked?: boolean }) {
  const split = priceSplit(total, passengers);
  const { t } = useI18n();
  return (
    <div className="price-hero text-center">
      <p className="text-sm text-muted">{t("per")}</p>
      <p className="text-3xl font-semibold tabular-nums">{customerPrice(split.perPassenger, marked)}</p>
      <p className="mt-2 text-sm text-muted">{t("total")}</p>
      <p className="text-xl font-semibold tabular-nums">{customerPrice(total, marked)}</p>
      <p className="mt-3 text-sm">
        {t("rates")} {euro(split.installment)}
      </p>
    </div>
  );
}

export function QuoteDetails({
  quote,
  passengers,
  routing,
  paymentMethod,
  onPayment,
  paymentError,
  paymentName,
}: {
  quote: Quote | null;
  passengers: number;
  routing: boolean;
  paymentMethod: PaymentMethod | "";
  onPayment: (method: PaymentMethod) => void;
  paymentError?: string;
  paymentName: string;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5" aria-live="polite">
      <div className="text-center">
        <h2 className="text-lg">{t("quote")}</h2>
        {routing ? <p className="text-sm text-muted">{t("updating")}</p> : null}
      </div>
      {quote ? (
        <>
          <div className="mt-3">
            <PriceSummary total={quote.total} passengers={passengers} marked={priceMarked(quote)} />
          </div>
          {quote.remote ? <p className="mt-3 text-sm text-muted">{t("remoteNotice")}</p> : null}
          <div className="mt-4">
            <PaymentChoice value={paymentMethod} onChange={onPayment} name={paymentName} error={paymentError} />
          </div>
          {quote.legs && quote.legs.length > 1 ? (
            <div className="mt-3 grid gap-1 text-sm text-muted">
              {quote.legs.map((leg) => (
                <p key={leg.label}>
                  {leg.label}: {legMeasure(leg.km, leg.minutes, quote.estimated)}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {kmLabel(quote.km)} · {formatDuration(quote.minutes)}
              {quote.estimated ? " · stima" : ""}
              {quote.sameDayChoice === "wait" ? " · stesso giorno: attesa sul posto, senza doppio chilometraggio" : ""}
            </p>
          )}
          <dl className="mt-4 grid gap-2 border-t border-border pt-4">
            {quote.lines.filter((line) => line.kind !== "slow").map((line) => {
              const standout = line.kind === "holiday" || line.kind === "night" || line.kind === "wait";
              return (
                <div key={line.label} className={`flex items-baseline justify-between gap-3 text-sm ${standout ? "font-medium text-fg" : ""}`}>
                  <dt className={standout ? "" : "text-muted"}>{line.label}</dt>
                  <dd className="tabular-nums">{euro(line.amount)}</dd>
                </div>
              );
            })}
          </dl>
          {quote.lines.some((line) => line.kind === "holiday") ? (
            <p className="mt-2 text-sm">C'è il supplemento festivo del 20% sulla percorrenza, domenica e giorni festivi.</p>
          ) : null}
          <p className="mt-4 text-sm text-muted">
            {quote.estimated
              ? "Distanza stimata, non sul percorso stradale. Il prezzo può cambiare in conferma."
              : "Distanza sul percorso stradale. Pedaggi autostradali inclusi nella tariffa."}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-muted">{t("pickRoute")}</p>
          <div className="mt-4">
            <PaymentChoice value={paymentMethod} onChange={onPayment} name={paymentName} error={paymentError} />
          </div>
        </>
      )}
      <p className="mt-3 text-sm text-muted">{t("tariffNote")}</p>
      <p className="mt-2 text-sm text-muted">{t("payRule")}</p>
    </section>
  );
}
