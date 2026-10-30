import { createFileRoute } from "@tanstack/react-router";
import Showcase from "@/pages/Showcase";
import { fetchShowcase } from "@/lib/api";

export const Route = createFileRoute("/showcase")({
  loader: async () => ({ tracks: await fetchShowcase().catch(() => []) }),
  component: ShowcasePage,
});

function ShowcasePage() {
  const data = Route.useLoaderData();
  return <Showcase initialTracks={data?.tracks ?? []} />;
}
