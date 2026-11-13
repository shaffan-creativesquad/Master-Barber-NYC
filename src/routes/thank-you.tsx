import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/thank-you")({
  component: ThankYouLayout,
});

function ThankYouLayout() {
  return <Outlet />;
}
