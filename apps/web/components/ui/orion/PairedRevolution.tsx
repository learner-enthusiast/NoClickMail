import * as React from "react";

type LoaderProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

export function PairedRevolution({ size = "lg", className = "" }: LoaderProps) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12", xl: "w-16 h-16" };
  const containerSize = sizeClasses[size] || sizeClasses.md;
  const primaryBgClass = "bg-zinc-950 dark:bg-zinc-50";
  return (
    <div className={`${containerSize} relative flex items-center justify-center ${className}`}>
      <style>{`
        @keyframes twinOrbitRotate {
          100% {
            transform: rotate(360deg) translate(155%);
          }
        }
      `}</style>
      <div
        className={`absolute rounded-full ${primaryBgClass}`}
        style={{ width: "25%", height: "25%", zIndex: 10 }}
      />
      <div className="absolute w-full h-full">
        <div
          className={`absolute rounded-full ${primaryBgClass}`}
          style={{
            width: "25%",
            height: "25%",
            top: "50%",
            left: "50%",
            transform: "rotate(0deg) translate(155%)",
            animation: "twinOrbitRotate 1.4s ease infinite",
            marginTop: "-12.5%",
            marginLeft: "-12.5%",
          }}
        />
        <div
          className={`absolute rounded-full ${primaryBgClass}`}
          style={{
            width: "25%",
            height: "25%",
            top: "50%",
            left: "50%",
            transform: "rotate(0deg) translate(155%)",
            animation: "twinOrbitRotate 1.4s ease infinite",
            animationDelay: "0.7s",
            marginTop: "-12.5%",
            marginLeft: "-12.5%",
          }}
        />
      </div>
    </div>
  );
}
