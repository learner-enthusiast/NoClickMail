/** Best-effort client clear for the non-httpOnly CSRF cookie (server clear is authoritative). */
export function clearCsrfCookieClient() {
  if (typeof document === "undefined") return;

  const hostname = window.location.hostname;
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `csrf_token=; expires=${expires}; path=/`;

  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const parentDomain = `.${parts.slice(-2).join(".")}`;
    document.cookie = `csrf_token=; expires=${expires}; path=/; domain=${parentDomain}`;
  }
}
