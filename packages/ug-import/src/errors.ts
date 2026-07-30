/** Every distinct way an import can fail. Each maps to a message that
 *  names the cause and the remedy. */
export type ImportFailure =
  | { kind: "challenge"; status: number; message: string }
  | { kind: "network"; message: string }
  | { kind: "schema"; message: string }
  | { kind: "pro-tab"; message: string };

export class ImportError extends Error {
  constructor(readonly failure: ImportFailure) {
    super(failure.message);
    this.name = "ImportError";
  }
}

export function describeFailure(f: ImportFailure): string {
  switch (f.kind) {
    case "challenge":
      return `Ultimate Guitar returned a challenge page (HTTP ${f.status}). Paste the tab text instead.`;
    case "network":
      return `Couldn't reach Ultimate Guitar: ${f.message}. Paste the tab text instead.`;
    case "schema":
      return "Couldn't read this page's data — the site format may have changed.";
    case "pro-tab":
      return "This looks like a Pro tab, which has no readable chord data.";
  }
}
