import { createFileRoute } from "@tanstack/react-router";
import { CustomerRequest } from "@/components/customer-request";

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [{ title: "La tua richiesta · MT Travel" }],
  }),
  component: RequestRoute,
});

function RequestRoute() {
  const { token } = Route.useParams();
  return <CustomerRequest token={token} />;
}
