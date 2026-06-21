import type { Metadata } from "next";
import { LegalPageLayout } from "~/components/ui/orion/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Orion",
  description: "How Orion collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 18, 2026">
      <p>
        Orion (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Orion web application
        at orion.arnabsamanta.in and related services. This Privacy Policy explains what information
        we collect, how we use it, and the choices you have.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Account information</h3>
      <p>
        When you sign in with Google, we receive your name, email address, profile picture, and
        email verification status. We store this in our database to create and manage your Orion
        account.
      </p>
      <h3>Connected Google services</h3>
      <p>
        If you connect Gmail and Google Calendar, Orion accesses mail and calendar data through
        Google&apos;s APIs on your behalf. This includes message metadata and content (subject,
        sender, body), calendar events, and OAuth tokens needed to keep your accounts in sync.
        Tokens are encrypted at rest using our integration layer.
      </p>
      <h3>Usage and AI interactions</h3>
      <p>
        When you use Orion Intelligence (our AI assistant), we process the prompts you send and
        relevant context (such as email or calendar content you ask about) through third-party AI
        providers (e.g. OpenAI) to generate responses. Chat messages may be stored in our database
        associated with your account.
      </p>
      <h3>Technical data</h3>
      <p>
        We automatically collect standard server logs, including IP address, browser type, request
        timestamps, and error diagnostics. We use cookies for authentication and CSRF protection.
      </p>

      <h2>2. How we use your information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Provide, operate, and improve Orion&apos;s email, calendar, and AI features</li>
        <li>Authenticate you and maintain your session securely</li>
        <li>Sync Gmail and Calendar changes in near real time via webhooks</li>
        <li>Generate AI summaries, drafts, and scheduling assistance at your request</li>
        <li>Protect against abuse, fraud, and unauthorized access</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p>
        We do not sell your personal information. Orion does not send email or create calendar
        events on your behalf without your explicit action.
      </p>

      <h2>3. Third-party services</h2>
      <p>Orion relies on the following categories of third parties:</p>
      <ul>
        <li>
          <strong>Google</strong> — OAuth sign-in, Gmail API, Google Calendar API, and Pub/Sub
          push notifications
        </li>
        <li>
          <strong>OpenAI</strong> — AI assistant features when you submit prompts
        </li>
        <li>
          <strong>Hosting and database providers</strong> — application infrastructure and data
          storage
        </li>
      </ul>
      <p>
        Each third party has its own privacy policy. We encourage you to review Google&apos;s and
        OpenAI&apos;s policies. Data shared with AI providers is limited to what is necessary to
        fulfill your request.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We retain account and connection data for as long as your account is active. Chat history
        and cached mail metadata are retained to provide the service. You may request deletion of
        your account by contacting us; upon deletion, we will remove or anonymize personal data
        within a reasonable period, except where retention is required by law.
      </p>

      <h2>5. Security</h2>
      <p>
        We use industry-standard measures including HTTPS, httpOnly authentication cookies, CSRF
        protection on mutations, encrypted storage of integration credentials, and rate limiting.
        No method of transmission over the Internet is 100% secure; we cannot guarantee absolute
        security.
      </p>

      <h2>6. Your rights and choices</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete personal data we hold about you</li>
        <li>Revoke Google access at any time via your Google Account permissions or Orion settings</li>
        <li>Disconnect Gmail or Calendar from the Connections menu in Orion</li>
        <li>Opt out of non-essential communications (if applicable)</li>
      </ul>
      <p>
        To exercise these rights, contact us at the address below. If you are in the EEA or UK, you
        may also lodge a complaint with your local data protection authority.
      </p>

      <h2>7. Children</h2>
      <p>
        Orion is not intended for users under 16. We do not knowingly collect personal information
        from children. If you believe a child has provided us data, please contact us so we can
        delete it.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Your data may be processed in countries other than your own, including where our servers or
        service providers operate. We take steps to ensure appropriate safeguards are in place.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the revised version on
        this page and update the &quot;Last updated&quot; date. Continued use of Orion after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this Privacy Policy? Contact us at{" "}
        <a href="mailto:privacy@arnabsamanta.in" className="text-primary underline">
          privacy@arnabsamanta.in
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
