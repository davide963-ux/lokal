/** A user-facing business-rule violation (safe to show verbatim). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
