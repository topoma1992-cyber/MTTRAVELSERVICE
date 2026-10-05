import { bagsLabel, euro, formatDuration, formatWhen, kmLabel, paymentNotice, peopleLabel } from "@/lib/format";
import { priceSplit, VEHICLES, billedWaitMinutes, waitBlockLabel } from "@/lib/tariff";
import type { Booking } from "@/lib/bookings";

function bufferToBinary(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return binary;
}

function blobToData(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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
    const logo = await fetch("/brand/logo-mark.jpg").then((response) => response.blob());
    doc.addImage(await blobToData(logo), "JPEG", 14, 12, 28, 28);
  } catch {
    // Il testo resta valido anche senza il marchio.
  }
  doc.setFont("LibSans", "bold");
  doc.setFontSize(16);
  doc.text("MT TRAVEL SERVICE", 46, 20);
  doc.setFont("LibSans", "normal");
  doc.setFontSize(10);
  doc.text("NOLEGGIO CON CONDUCENTE · Gambettola (FC)", 46, 27);
  doc.text("www.mttravelservice.com", 46, 33);
  doc.setFont("LibSans", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 50);
  return { doc, y: 59 };
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
  const vehicle = VEHICLES[trip.vehicle];
  const rows: Array<[string, string]> = [
    ["Cliente", `${customer.firstName} ${customer.lastName}`],
    ["Telefono", customer.phone],
    ["Email", customer.email],
    ["Veicolo", `${vehicle.name} · ${vehicle.detail}`],
    ["Passeggeri", peopleLabel(trip.passengers)],
    ["Bagagli standard", bagsLabel(trip.luggage)],
    ["Partenza", trip.origin.label],
    ...trip.stops.map((stop, index) => [`Fermata ${index + 1}`, stop.label] as [string, string]),
    ["Arrivo", trip.destination.label],
    ["Data", formatWhen(trip.date, trip.time)],
    ["Ritorno", trip.roundTrip ? formatWhen(trip.returnDate, trip.returnTime) : "Solo andata"],
    ["Distanza", `${kmLabel(quote.km)}${quote.estimated ? " (stima)" : ""}`],
    ["Durata", formatDuration(quote.minutes)],
  ];
  if (trip.meetGreet && trip.landingTime) {
    rows.push(["Volo", trip.flight.trim() || "—"]);
    rows.push(["Atterraggio previsto", formatWhen(trip.landingDate || trip.date, trip.landingTime)]);
    rows.push([
      "Meet & greet",
      `Cartello nominativo. Attesa gratuita: 1 ora dall'atterraggio previsto. Ritrovo ${formatWhen(trip.date, trip.time)}`,
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

export async function downloadBookingPdf(booking: Booking) {
  const { doc, y: start } = await openDoc(`Richiesta ${booking.code}`);
  const { trip, customer, quote } = booking;
  let y = writeRows(doc, tripRows(booking), start);

  const split = priceSplit(quote.total, trip.passengers);
  y += 3;
  doc.setFont("LibSans", "bold");
  doc.setFontSize(14);
  doc.text("A passeggero", 14, y);
  doc.text(euro(split.perPassenger), 196, y, { align: "right" });
  y += 8;
  doc.setFontSize(12);
  doc.text("Totale", 14, y);
  doc.text(euro(quote.total), 196, y, { align: "right" });
  y += 7;
  doc.setFont("LibSans", "normal");
  doc.setFontSize(11);
  if (booking.paymentMethod === "rate") {
    doc.text(`4 rate da ${euro(split.installment)}`, 14, y);
    y += 6;
    doc.text(`Totale a rate ${euro(split.installmentTotal)} (+5%)`, 14, y);
    y += 8;
  } else {
    y += 2;
  }
  for (const line of quote.lines) {
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
  doc.setFontSize(10);
  const legal = doc.splitTextToSize(
    "Acqua fresca inclusa. A bordo è vietato mangiare e fumare. Preventivo indicativo, da confermare da MT Travel. " +
      paymentNotice(trip.date, trip.time),
    180,
  );
  doc.text(legal, 14, Math.min(y, 280));
  doc.save(`MT-Travel-${booking.code}.pdf`);
}

export async function downloadDriverPdf(booking: Booking, amount: number) {
  const { doc, y: start } = await openDoc("ASSEGNAZIONE VIAGGIO");
  const { customer } = booking;
  let y = writeRows(doc, tripRows(booking), start);
  y += 4;
  doc.setFont("LibSans", "bold");
  doc.setFontSize(14);
  doc.text("Compenso autista", 14, y);
  doc.text(euro(amount), 196, y, { align: "right" });
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
