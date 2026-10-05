import { createFileRoute } from "@tanstack/react-router";
import { BookingPage } from "@/components/booking-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Prenota · MT Travel" }],
  }),
  component: BookingPage,
});
