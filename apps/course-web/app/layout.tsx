import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "~/providers/global";

export const metadata: Metadata = {
  title: "Course RAG",
  description: "Ask questions about Udemy course transcripts (VTT/SRT)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
