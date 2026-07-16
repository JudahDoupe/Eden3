export class VitalityController {
  private vitality: number;
  private lastDecrementMs: number | null = null;
  private readonly INTERVAL_MS = 1000 as const;

  constructor() {
    this.vitality = 10;
    this.lastDecrementMs = performance.now();
  }

  public decrement(): void {
    const now = performance.now();
    
    if (this.lastDecrementMs === null) {
      this.lastDecrementMs = now;
      return;
    }

    if (now - this.lastDecrementMs >= this.INTERVAL_MS) {
      this.vitality -= 1;
      this.lastDecrementMs = now;
    }
  }

  public getValue(): number {
    return Math.max(0, this.vitality);
  }
}