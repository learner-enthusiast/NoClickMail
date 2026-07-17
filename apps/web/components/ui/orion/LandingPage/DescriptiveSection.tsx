"use client";
import React from "react";
const DescriptiveSection = () => {
  return (
    <div className="text-center flex flex-col gap-5">
      <p className="text-4xl font-bold">Experience Quiet Intelligence</p>
      <p className="text-2xl text-muted-foreground">
        Engineered for high-output professionals who value mental clarity .
      </p>
      <div id="workflows">
        <AnimationContainer />
      </div>
    </div>
  );
};

export default DescriptiveSection;

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { motion } from "motion/react";
import { OrionLogo } from "../OrionLogo";

const PATHS = [
  { d: "M 0 0 L 0 404.609", transform: "translate(370 0)", dim: 20 },
  {
    d: "M 164 0 L 98.814 0 L 0 83.557 L 0 205",
    transform: "translate(400 110)",
  },
  {
    d: "M 0 0 L 56.317 0 C 93.572 34.834 114.632 53.417 155 84.826 L 155 206",
    transform: "translate(181.152 110)",
  },
  { d: "M 0 0 L 295 0 L 295 81", transform: "translate(0 221)" },
  { d: "M 296 0 L 0 0 L 0 79", transform: "translate(438 221)" },
] as const;

const SEGMENT = 0.1;
const GAP = 1 - SEGMENT;

function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[calc(100%-0.5rem)] border border-outline bg-linear-to-tr from-surface-container/80 to-transparent px-2 py-1.5 text-center font-mono text-label-sm uppercase tracking-[0.04em] text-on-surface backdrop-blur-sm sm:px-3 sm:py-2 md:w-60 md:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function AnimatedLine({ d, transform }: { d: string; transform: string }) {
  return (
    <g transform={transform}>
      <path
        d={d}
        stroke="color-mix(in srgb, var(--color-on-surface) 20%, transparent)"
        strokeWidth={3}
      />
      <motion.path
        d={d}
        pathLength={1}
        stroke="var(--color-on-surface)"
        strokeWidth={1.5}
        strokeLinecap="butt"
        strokeDasharray={`${SEGMENT} ${GAP}`}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -(SEGMENT + GAP) }}
        transition={{
          duration: 2.5,
          ease: "linear",
          repeat: Infinity,
          repeatType: "loop",
          repeatDelay: 0.5,
        }}
      />
    </g>
  );
}

function AnimationContainer() {
  const TAGS = [
    {
      label: "Inbox",
      className: "absolute left-[50.41%] top-0 z-10 w-fit -translate-x-1/2",
    },
    {
      label: "Draft replies",
      className: "absolute left-[24.68%] top-[27.16%] z-10 w-fit -translate-x-1/2",
    },
    {
      label: "Calendar invites",
      className:
        "absolute left-[76.84%] top-[27.16%] z-10 w-fit max-w-[60%] -translate-x-1/2 sm:max-w-none",
    },
    {
      label: "Urgent threads",
      className: "absolute left-0 top-[49.57%] z-10 w-fit -translate-x-1/2",
    },
    {
      label: "Meeting prep",
      className: "absolute left-full top-[49.57%] z-10 w-fit -translate-x-1/2",
    },
  ] as const;
  return (
    <div className="pointer-events-none  w-full px-3 pb-12 sm:px-6 sm:pb-16 md:pb-20 lg:pb-28">
      {/* Stage matches the SVG viewBox aspect ratio (734:405) so tags can be
          anchored to the exact start point of each line using percentages. */}
      <div className="relative mx-auto aspect-734/405 max-h-[35vh] w-full max-w-[734px]">
        {/* Company page Visits -> line start (370, 0) */}
        {TAGS.map((tag) => (
          <Tag key={tag.label} className={tag.className}>
            {tag.label}
          </Tag>
        ))}

        <svg
          role="presentation"
          viewBox="0 0 734 405"
          className="absolute inset-0 h-full w-full"
          fill="none"
        >
          {PATHS.map((path) => (
            <AnimatedLine key={path.d} {...path} />
          ))}
        </svg>

        {/* Destination node where every line converges (bottom center). */}
        <div className="absolute bottom-0 left-[50.41%] size-40 -translate-x-1/2 translate-y-1/2 rounded-md bg-transparent p-1.5 sm:size-28 sm:p-2 md:size-36 lg:size-52">
          <OrionLogo className="text-primary" />
        </div>
      </div>
    </div>
  );
}
