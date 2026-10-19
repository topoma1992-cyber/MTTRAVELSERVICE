import { createFileRoute, Link } from "@tanstack/react-router";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · MT Travel" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <p className="text-sm text-primary">Informativa</p>
      <h1 className="mt-1 text-center text-2xl">Privacy</h1>
      <div className="mt-6 grid gap-4 text-sm leading-relaxed">
        <p>
          Titolare del trattamento: {COMPANY.owner}, P.IVA {COMPANY.vat}, {COMPANY.brand}, noleggio con conducente,{" "}
          {COMPANY.place}. Email {COMPANY.email}.
        </p>
        <p>
          Per la richiesta di transfer raccogliamo nome, cognome, telefono, email, note e i dati del viaggio (indirizzi,
          data, ora, passeggeri, bagagli). Servono solo a preparare il preventivo, confermare la corsa e ricontattarti.
        </p>
        <p>
          La base è la tua richiesta di un servizio, prima del contratto, e il consenso che dai inviando il modulo. I dati
          non vengono venduti. Restano per il tempo del servizio e per gli obblighi di legge, poi si cancellano.
        </p>
        <p>
          Puoi chiedere accesso, correzione o cancellazione scrivendo a {COMPANY.email}. Puoi anche proporre reclamo al
          Garante per la protezione dei dati personali.
        </p>
        <p>
          <Link to="/" className="underline underline-offset-2">
            Torna alla prenotazione
          </Link>
        </p>
      </div>
    </main>
  );
}
