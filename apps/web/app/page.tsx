import { OrionLandingPage } from "~/components/ui/orion/OrionLandingPage";
import { SmoothScrollProvider } from "~/providers/smooth-scroll";
import { api } from "~/trpc/server";

export default async function Home() {
  const { status } = await api.health.getHealth.query();
  return (
    <SmoothScrollProvider>
      <OrionLandingPage />
    </SmoothScrollProvider>
  );
}
