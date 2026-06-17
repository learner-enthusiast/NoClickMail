import React from "react";
import { Button } from "../../button";
import Image from "next/image";

const HeroSection = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <p className="type-hero-header">
        Your AI Executive Assistant for <br />{" "}
        <p className="text-secondary-accent">Email and Calender</p>
      </p>
      <p className="type-hero-subHeader max-w-[720px]">
        Manage emails,scheule meetings,draft responses , and stay productive with an AI assistant
        that works alongside you
      </p>

      <div className="flex flex-row gap-2">
        <Button size="lg">Get Started</Button>
        <Button size="lg" variant="outline">
          View Demo
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
