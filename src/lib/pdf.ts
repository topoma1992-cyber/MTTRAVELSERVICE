import { bagsLabel, customerPrice, euro, formatDuration, formatWhen, kmLabel, legMeasure, paymentNotice, peopleLabel, priceMarked, REMOTE_NOTICE } from "@/lib/format";
import { fleetText } from "@/lib/tariff";
import { priceSplit, billedWaitMinutes, waitBlockLabel } from "@/lib/tariff";
import { COMPANY, VAT_ZERO_NOTE } from "@/lib/company";
import { paymentLabel, type Booking } from "@/lib/bookings";

export type VatChoice = "zero" | "ten";

function bufferToBinary(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return binary;
}

async function logoDataUrl() {
  const response = await fetch("/brand/logo-mark.jpg");
  if (!response.ok) throw new Error("logo");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0);
  return canvas.toDataURL("image/png");
}
async function openDoc(title: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const regular = await fetch("/fonts/LiberationSans-Regular.ttf").then((response) => response.arrayBuffer());
  const bold = await fetch("/fonts/LiberationSans-Bold.ttf").then((response) => response.arrayBuffer());
  doc.addFileToVFS("LiberationSans-Regular.ttf", bufferToBinary(regular));
  doc.addFileToVFS("LiberationSans-Bold.ttf", bufferToBinary(bold));
  doc.addFont("LiberationSans-Regular.ttf", "LibSans", "normal");
  doc.addFont("LiberationSans-Bold.ttf", "LibSans", "bold");
  doc.setFont("LibSans", "normal");
  try {
    doc.addImage(await logoDataUrl(), "PNG", 14, 12, 28, 28);
  } catch {
    // Il testo resta valido anche senza il marchio.
  }
  doc.setFont("LibSans", "bold");
  doc.setFontSize(16);
  doc.text(COMPANY.brand, 46, 20);
  doc.setFont("LibSans", "normal");
  doc.setFontSize(10);
  doc.text(`NOLEGGIO CON CONDUCENTE · ${COMPANY.place}`, 46, 27);
  doc.text(COMPANY.site, 46, 33);
  doc.text(`${COMPANY.owner} · P.IVA ${COMPANY.vat}`, 46, 39);
  doc.setFont("LibSans", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 54);
  return { doc, y: 64 };
}

function writeRows(doc: import("jspdf").jsPDF, rows: Array<[string, string]>, startY: number) {
  let y = startY;
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    const lines = doc.splitTextToSize(value, 125);
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("LibSans", "bold");
    doc.text(label, 14, y);
    doc.setFont("LibSans", "normal");
    doc.text(lines, 52, y);
    y += Math.max(6, lines.length * 5);
  }
  return y;
}

function tripRows(booking: Booking) {
  const { trip, customer, quote } = booking;
  const rows: Array<[string, string]> = [
    ["Cliente", `${customer.firstName} ${customer.lastName}`],
    ["Telefono", customer.phone],
    ["Email", customer.email],
    ["Veicolo", fleetText(trip)],
    ["Passeggeri", peopleLabel(trip.passengers)],
    ["Bagagli standard", bagsLabel(trip.luggage)],
    ["Partenza", trip.origin.label],
    ...trip.stops.map((stop, index) => [`Fermata ${index + 1}`, stop.label] as [string, string]),
    ["Arrivo", trip.destination.label],
    ["Data", formatWhen(trip.date, trip.time)],
    ["Ritorno", trip.roundTrip ? formatWhen(trip.returnDate, trip.returnTime) : "Solo andata"],
  ];
  if (trip.roundTrip && trip.vehicleStay) {
    rows.push(["Veicolo a disposizione", "Sì, per tutta l'attesa scelta"]);
  }
  if (quote.legs && quote.legs.length > 1) {
    for (const leg of quote.legs) {
      rows.push([leg.label, legMeasure(leg.km, leg.minutes, quote.estimated)]);
    }
  } else {
    rows.push(["Distanza", `${kmLabel(quote.km)}${quote.estimated ? " (stima)" : ""}`]);
    rows.push(["Durata", formatDuration(quote.minutes)]);
  }
  if (trip.meetGreet && trip.landingTime) {
    rows.push(["Volo", trip.flight.trim() || "—"]);
    rows.push(["Atterraggio previsto", formatWhen(trip.landingDate || trip.date, trip.landingTime)]);
    rows.push([
      "Meet & greet",
      `Cartello nominativo. Attesa gratuita: 1 ora dall'atterraggio previsto.`,
    ]);
  } else if (trip.flight.trim()) {
    rows.push(["Volo o treno", trip.flight.trim()]);
  }
  if (trip.oversizedNote?.trim()) {
    rows.push(["Fuori misura", trip.oversizedNote.trim()]);
  }
  if (trip.waitMinutes > 0) {
    const billed = billedWaitMinutes(trip.waitMinutes);
    rows.push([
      "Attesa extra",
      billed > 0
        ? `${waitBlockLabel(billed)} a pagamento`
        : trip.meetGreet
          ? "Inclusa nell'ora gratuita dall'atterraggio previsto"
          : "Entro 15 min, inclusa",
    ]);
  }
  return rows;
}

function writeVat(doc: import("jspdf").jsPDF, startY: number, total: number, vat: VatChoice) {
  let y = startY;
  doc.setFont("LibSans", "normal");
  doc.setFontSize(10);
  if (vat === "ten") {
    const taxable = Math.round((total / 1.1) * 100) / 100;
    const tax = Math.round((total - taxable) * 100) / 100;
    doc.text(`Imponibile ${euro(taxable)}`, 14, y);
    y += 5;
    doc.text(`IVA 10% ${euro(tax)}`, 14, y);
    y += 5;
    doc.text("Il totale indicato è già comprensivo di IVA al 10%.", 14, y);
    y += 6;
  } else {
    const lines = doc.splitTextToSize(VAT_ZERO_NOTE, 180);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 2;
  }
  return y;
}

export async function downloadBookingPdf(booking: Booking, vat: VatChoice) {
  const { doc, y: start } = await openDoc(`Richiesta ${booking.code}`);
  const { trip, customer, quote } = booking;
  let y = writeRows(doc, tripRows(booking), start);

  const split = priceSplit(quote.total, trip.passengers);
  y += 3;
  doc.setFont("LibSans", "bold");
  doc.setFontSize(14);
  doc.text("A passeggero", 14, y);
  doc.text(customerPrice(split.perPassenger, priceMarked(quote)), 196, y, { align: "right" });
  y += 8;
  doc.setFontSize(12);
  doc.text("Totale", 14, y);
  doc.text(customerPrice(quote.total, priceMarked(quote)), 196, y, { align: "right" });
  y += 7;
  doc.setFont("LibSans", "normal");
  doc.setFontSize(11);
  doc.text("Metodo di pagamento", 14, y);
  doc.text(paymentLabel(booking.paymentMethod), 196, y, { align: "right" });
  y += 7;
  if (quote.remote) {
    doc.setFont("LibSans", "normal");
    doc.setFontSize(10);
    const notice = doc.splitTextToSize(REMOTE_NOTICE, 180);
    doc.text(notice, 14, y);
    y += notice.length * 4 + 2;
  }
  doc.setFont("LibSans", "normal");
  doc.setFontSize(11);
  if (booking.paymentMethod === "rate") {
    doc.text(`4 rate Scalapay da ${euro(split.installment)}`, 14, y);
    y += 8;
  } else {
    y += 2;
  }
  for (const line of quote.lines.filter((item) => item.kind !== "slow")) {
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
    doc.text(line.label, 14, y);
    doc.text(euro(line.amount), 196, y, { align: "right" });
    y += 6;
  }

  if (customer.notes.trim()) {
    y += 3;
    doc.setFont("LibSans", "bold");
    doc.text("Note", 14, y);
    y += 6;
    doc.setFont("LibSans", "normal");
    const notes = doc.splitTextToSize(customer.notes.trim(), 180);
    doc.text(notes, 14, y);
    y += notes.length * 5 + 2;
  }

  y += 4;
  y = writeVat(doc, y, quote.total, vat);
  doc.setFontSize(10);
  const legal = doc.splitTextToSize(
    "Acqua fresca inclusa. A bordo è vietato mangiare e fumare. Preventivo indicativo, da confermare da MT Travel. " +
      paymentNotice(trip.date, trip.time),
    180,
  );
  doc.text(legal, 14, Math.min(y, 280));
  doc.save(`MT-Travel-${booking.code}.pdf`);
}

export async function downloadDriverPdf(booking: Booking, amount: number, vat: VatChoice) {
  const { doc, y: start } = await openDoc("ASSEGNAZIONE VIAGGIO");
  const { customer } = booking;
  let y = writeRows(doc, tripRows(booking), start);
  y += 4;
  doc.setFont("LibSans", "bold");
  doc.setFontSize(14);
  doc.text("Compenso autista", 14, y);
  doc.text(euro(amount), 196, y, { align: "right" });
  y = writeVat(doc, y + 8, amount, vat);
  if (customer.notes.trim()) {
    y += 8;
    doc.setFont("LibSans", "bold");
    doc.text("Note", 14, y);
    y += 6;
    doc.setFont("LibSans", "normal");
    doc.text(doc.splitTextToSize(customer.notes.trim(), 180), 14, y);
  }
  doc.save(`MT-Travel-viaggio-${booking.code}.pdf`);
}
