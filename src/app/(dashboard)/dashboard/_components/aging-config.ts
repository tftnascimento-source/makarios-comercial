export type AgingBucket = "1-30" | "31-60" | "61-90" | "+90";

export const AGING_SLICES_CONFIG: {
  bucket: AgingBucket;
  label: string;
  color: string;
}[] = [
  { bucket: "1-30",  label: "1–30 dias",       color: "#F59E0B" },
  { bucket: "31-60", label: "31–60 dias",       color: "#F97316" },
  { bucket: "61-90", label: "61–90 dias",       color: "#EF4444" },
  { bucket: "+90",   label: "Acima de 90 dias", color: "#B91C1C" },
];
