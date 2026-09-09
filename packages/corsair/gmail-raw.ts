/** Strip invalid From headers agents often add (e.g. `From: me`). Gmail sets the sender automatically. */
export function sanitizeGmailRawMessage(raw: string): string {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const fixed = decoded
      .split(/\r?\n/)
      .filter((line) => !/^From:\s*me\s*$/i.test(line.trim()))
      .join("\r\n");

    if (fixed === decoded) return raw;
    return Buffer.from(fixed).toString("base64url");
  } catch {
    return raw;
  }
}
