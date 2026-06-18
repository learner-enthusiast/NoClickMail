import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export async function verifyPubSubPush(
  req: { header: (name: string) => string | undefined },
  audience: string,
): Promise<boolean> {
  const auth = req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  try {
    const ticket = await client.verifyIdToken({
      idToken: auth.slice(7),
      audience,
    });
    const claims = ticket.getPayload();
    if (!claims?.email_verified) return false;
    return Boolean(claims.email?.endsWith("gserviceaccount.com"));
  } catch {
    return false;
  }
}
