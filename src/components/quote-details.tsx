import { PaymentChoice } from "@/components/payment-marks";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/bookings";
import { euro, formatDuration, kmLabel, paymentNotice } from "@/lib/format";
import { priceSplit, type Quote } from "@/lib/tariff";

export function PriceSummary({ total, passengers }: { total: number; passengers: number }) {
  const split = priceSplit(total, passengers);
  const { t } = useI18n();
  return (
    <div>
      <p className="text-sm text-muted">{t("per")}</p>
      <p className="font-display text-4xl tabular-nums">{euro(split.perPassenger)}</p>
      <p className="mt-2 text-sm text-muted">{t("total")}</p>
      <p className="font-display text-2xl tabular-nums">{euro(total)}</p>
      <p className="mt-3 text-sm">
        {t("rates")} {euro(split.installment)}
      </p>
      <p className="text-sm text-muted">
        {t("ratesTotal")} {euro(split.installmentTotal)}, {t("ratesMore")}
      </p>
    </div>
  );
}

export function QuoteDetails({
  quote,
  passengers,
  routing,
  whenDate,
  whenTime,
  paymentMethod,
  onPayment,
  paymentError,
  paymentName,
}: {
  quote: Quote | null;
  passengers: number;
  routing: boolean;
  whenDate: string;
  whenTime: string;
  paymentMethod: PaymentMethod | "";
  onPayment: (method: PaymentMethod) => void;
  paymentError?: string;
  paymentName: string;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">{t("quote")}</h2>
        {routing ? <span className="text-sm text-muted">{t("updating")}</span> : null}
      </div>
      {quote ? (
        <>
          <div className="mt-3">
            <PriceSummary total={quote.total} passengers={passengers} />
          </div>
          <div className="mt-4">
            <PaymentChoice value={paymentMethod} onChange={onPayment} name={paymentName} error={paymentError} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {kmLabel(quote.km)} · {formatDuration(quote.minutes)}
            {quote.estimated ? " · stima" : ""}
            {quote.sameDayChoice === "wait" ? " · stesso giorno: attesa sul posto, senza doppio chilometraggio" : ""}
            {quote.sameDayChoice === "round" ? " · stesso giorno: andata e ritorno più conveniente dell'attesa" : ""}
          </p>
          <dl className="mt-4 grid gap-2 border-t border-border pt-4">
            {quote.lines.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-muted">{line.label}</dt>
                <dd className="tabular-nums">{euro(line.amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted">
            {quote.estimated
              ? "Distanza stimata, non sul percorso stradale. Il prezzo può cambiare in conferma."
              : "Distanza sul percorso stradale. Pedaggi e parcheggi, se dovuti, si concordano in conferma."}
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
      <p className="mt-3 text-sm text-muted">
        Tariffa indicativa, senza diritto di partenza. Minimo 45 € in auto e 50 € in van. Fino a 15 minuti di attesa
        sono inclusi. Oltre, l'attesa è 50 €/h in auto e 60 €/h in van, a scatti di 30 minuti. Con meet & greet,
        l'attesa gratuita in aeroporto con cartello nominativo è 1 ora dall'orario di atterraggio previsto del volo.
        L'acqua è inclusa: a bordo non si mangia e non si fuma.
      </p>
      <p className="mt-2 text-sm text-muted">{paymentNotice(whenDate, whenTime)}</p>
    </section>
  );
}
