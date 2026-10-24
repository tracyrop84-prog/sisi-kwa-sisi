export function formatKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function percentRaised(raised: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}
