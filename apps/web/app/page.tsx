import { SmoothScrollProvider } from "~/providers/smooth-scroll";
import { api } from "~/trpc/server";
import HeroSection from "~/components/ui/orion/LandingPage/HeroSection";
import DescriptiveSection from "~/components/ui/orion/LandingPage/DescriptiveSection";
import How from "~/components/ui/orion/LandingPage/How";
import Integrations from "~/components/ui/orion/LandingPage/Integrations";
export default async function Home() {
  const { status } = await api.health.getHealth.query();
  return (
    <div className="max-w-[1440px]  mx-auto  border border-x-border">
      <div className="mt-28">
        <SmoothScrollProvider>
          <HeroSection />
          <DescriptiveSection />
          <Integrations />
          {/* <How /> */}
        </SmoothScrollProvider>
      </div>
    </div>
  );
}
