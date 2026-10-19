import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/bookings";
import { useI18n, type CopyKey } from "@/lib/i18n";

const PAY_KEYS: Record<PaymentMethod, CopyKey> = {
  bonifico: "payBank",
  link: "payLink",
  satispay: "paySatispay",
  rate: "payRate",
};

export function PaymentBadge({ method }: { method: PaymentMethod }) {
  if (method === "link") {
    return <span className="pay-link inline-flex h-7 items-center rounded px-2 text-xs font-extrabold tracking-wide">LINK</span>;
  }
  if (method === "bonifico") {
    return (
      <span className="pay-bank inline-flex h-7 items-center rounded px-2 text-xs font-extrabold tracking-wide">BONIFICO</span>
    );
  }
  if (method === "satispay") {
    return (
      <span className="pay-satispay inline-flex h-7 items-center rounded px-2 text-xs font-extrabold tracking-tight">
        satispay
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 items-center rounded border border-border bg-surface px-2 text-xs font-extrabold tracking-wide">
      SCALAPAY
    </span>
  );
}

export function PaymentChoice({
  value,
  onChange,
  name,
  error,
}: {
  value: PaymentMethod | "";
  onChange: (method: PaymentMethod) => void;
  name: string;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="grid gap-2" data-invalid={error ? "true" : undefined}>
      <legend className="text-sm font-medium">{t("pay")}</legend>
      <p className="text-lg font-extrabold leading-snug text-fg">{t("payNow")}</p>
      <p className="text-base leading-snug text-fg">{t("payLater")}</p>
      <div className="mt-1 grid gap-2">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.id}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 ${
              value === method.id ? "border-primary bg-surface-2" : "border-border bg-bg"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <input type="radio" name={name} checked={value === method.id} onChange={() => onChange(method.id)} />
              {t(PAY_KEYS[method.id])}
            </span>
            <PaymentBadge method={method.id} />
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
    </fieldset>
  );
}
