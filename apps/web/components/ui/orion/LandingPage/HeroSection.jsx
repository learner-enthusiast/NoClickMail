"use client";
import React from "react";
import { Button } from "../../button";
import Image from "next/image";
import { InViewAnnotation } from "../glitches/glitches";
import { useRouter } from "next/navigation";

const HeroSection = () => {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <h1 className="type-hero-header">
        Your AI Executive Assistant for <br />{" "}
        <p className="text-secondary-accent">Email and Calender</p>
      </h1>
      <p className="type-hero-subHeader max-w-[720px]">
        Manage emails,scheule meetings,draft responses , and stay productive with an AI assistant
        <InViewAnnotation> that works alongside you</InViewAnnotation>
      </p>

      <div className="flex flex-row gap-2">
        <Button size="lg" onClick={() => router.push("/api-auth/login")}>
          Get Started
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() =>
            router.push(
              "https://drive.google.com/file/d/1cSbsF04Gzvs6Jt0ESqq7HwHsbd1Gd5KI/view?usp=sharing",
            )
          }
        >
          View Founder Video
        </Button>
      </div>
      <Image
        src="/hero1-light.png"
        alt="Hero Section"
        width={1080}
        height={1080}
        className="dark:hidden"
        priority
      />
      <Image
        src="/hero1.png"
        alt="Hero Section"
        width={1080}
        height={1080}
        className="hidden dark:block"
        priority
      />
    </div>
  );
};
export default HeroSection;
