import { api } from "~/trpc/server";
import HeroSection from "~/components/ui/orion/LandingPage/HeroSection";
import DescriptiveSection from "~/components/ui/orion/LandingPage/DescriptiveSection";
import Integrations from "~/components/ui/orion/LandingPage/Integrations";

export default async function Home() {
  await api.health.getHealth.query();
  return (
    <div className="mx-auto max-w-[1440px] border border-x-border">
      <div className="mt-28">
        <HeroSection />
        <DescriptiveSection />
        <Integrations />
        {/* <How /> */}
      </div>
    </div>
  );
}
