/**
 * One share path for every strip: the native share sheet when the platform has
 * one, the clipboard when it does not, and an honest "failed" when the user
 * dismisses — a dismissed share must not announce "copied."
 */
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Share composed plain text (receipts) — same fallback ladder as shareLink. */
export async function shareText(text: string, title: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
