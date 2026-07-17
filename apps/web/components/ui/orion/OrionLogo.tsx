import * as React from "react";

type OrionLogoProps = React.SVGProps<SVGSVGElement>;

export function OrionLogo(props: OrionLogoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" {...props}>
      <g stroke="currentColor" strokeWidth={12} strokeLinecap="round">
        {/* Outer Orbit */}
        <circle cx={256} cy={256} r={170} />

        {/* Break in orbit */}
        <path d="M395 147 A170 170 0 0 1 425 256" />

        {/* Small orbiting star */}
        <circle cx={410} cy={175} r={12} fill="currentColor" stroke="none" />
      </g>

      {/* Orion Star */}
      <path
        fill="currentColor"
        d="
          M256 70
          C270 150 310 190 442 256
          C310 322 270 362 256 442
          C242 362 202 322 70 256
          C202 190 242 150 256 70
          Z
        "
      />
    </svg>
  );
}
