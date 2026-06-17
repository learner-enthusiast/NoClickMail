import { SmoothScrollProvider } from "~/providers/smooth-scroll";
import { api } from "~/trpc/server";
import HeroSection from "~/components/ui/orion/LandingPage/HeroSection";
import DescriptiveSection from "~/components/ui/orion/LandingPage/DescriptiveSection";
export default async function Home() {
  const { status } = await api.health.getHealth.query();
  return (
    <div className="max-w-[1080px]  mx-auto mt-28">
      <SmoothScrollProvider>
        <HeroSection />
        <DescriptiveSection />
      </SmoothScrollProvider>
    </div>
  );
}
