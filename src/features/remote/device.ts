function detectPlatform(userAgent: string): string | null {
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

function detectBrowser(userAgent: string): string | null {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/CriOS/i.test(userAgent)) return "Chrome";
  if (/FxiOS/i.test(userAgent)) return "Firefox";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return null;
}

export function deviceLabel(userAgent: string | null | undefined): string {
  const raw = (userAgent ?? "").trim();
  if (!raw) return "Dispositivo desconhecido";

  const platform = detectPlatform(raw);
  const browser = detectBrowser(raw);
  if (!browser) return platform ?? "Dispositivo desconhecido";
  return platform ? `${platform} · ${browser}` : browser;
}
