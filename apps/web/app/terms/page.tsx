import type { Metadata } from "next";
import { LegalPageLayout } from "~/components/ui/orion/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Orion",
  description: "Terms and conditions for using Orion.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="June 18, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Orion, an AI
        executive assistant for email and calendar operated by Arnab Samanta (&quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;). By using Orion, you agree to these Terms. If you do not
        agree, do not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        Orion provides tools to connect your Gmail and Google Calendar accounts, view and manage
        mail, schedule events, and interact with an AI assistant that can summarize, draft, and
        rewrite content. Features may change, be added, or be removed at any time.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 16 years old and capable of forming a binding contract to use Orion.
        You must comply with Google&apos;s terms when connecting Gmail and Calendar, and with
        OpenAI&apos;s terms when using AI features.
      </p>

      <h2>3. Your account</h2>
      <p>
        You are responsible for maintaining the security of your account and for all activity under
        it. Sign-in is handled through Google OAuth. You must provide accurate information and
        notify us promptly of any unauthorized use.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use Orion for unlawful, harmful, or fraudulent purposes</li>
        <li>Send spam, malware, or harassing content through connected accounts</li>
        <li>Attempt to bypass authentication, rate limits, or security controls</li>
        <li>Reverse engineer, scrape, or overload the service without permission</li>
        <li>Use Orion to process data you do not have the right to access</li>
        <li>Resell or sublicense the service without our written consent</li>
      </ul>
      <p>
        We may suspend or terminate access if we reasonably believe you have violated these Terms.
      </p>

      <h2>5. Google and third-party integrations</h2>
      <p>
        Orion connects to Google services via OAuth. You authorize us to access the scopes you
        approve during connection. You can revoke access at any time through Google Account settings
        or Orion&apos;s Connections menu. We are not responsible for Google&apos;s availability,
        policies, or changes to their APIs.
      </p>

      <h2>6. AI-generated content</h2>
      <p>
        Orion Intelligence uses artificial intelligence to generate summaries, drafts, and
        suggestions. AI output may be inaccurate, incomplete, or inappropriate. You are solely
        responsible for reviewing and approving any email, calendar invite, or other action before
        it is sent. We do not guarantee the accuracy or suitability of AI-generated content.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        Orion, its branding, software, and documentation are owned by us or our licensors. You
        retain ownership of your content (emails, calendar data, prompts). You grant us a limited
        license to process your content solely to provide and improve the service.
      </p>

      <h2>8. Privacy</h2>
      <p>
        Our collection and use of personal data is described in our{" "}
        <a href="/privacy" className="text-primary underline">
          Privacy Policy
        </a>
        , which is incorporated into these Terms by reference.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        ORION IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
        KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
        SECURE.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR AFFILIATES SHALL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
        DATA, OR GOODWILL, ARISING FROM YOUR USE OF ORION. OUR TOTAL LIABILITY FOR ANY CLAIM
        RELATING TO THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE
        THE CLAIM, OR ONE HUNDRED U.S. DOLLARS (USD $100), WHICHEVER IS GREATER.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold us harmless from claims, damages, and expenses (including
        reasonable legal fees) arising from your use of Orion, your content, or your violation of
        these Terms or applicable law.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using Orion at any time. We may suspend or terminate your access with or
        without notice for violation of these Terms, operational reasons, or discontinuation of the
        service. Provisions that by nature should survive termination (including disclaimers,
        liability limits, and indemnification) will survive.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may modify these Terms at any time. We will post the updated version on this page and
        update the &quot;Last updated&quot; date. Material changes may be communicated through the
        app or by email where appropriate. Continued use after changes constitutes acceptance.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-law principles.
        Disputes shall be subject to the exclusive jurisdiction of courts in Hyderabad, Telangana,
        India, unless applicable law requires otherwise.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:loveumearnab.2812000@gmail.com" className="text-primary underline">
          legal@arnabsamanta.in
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
