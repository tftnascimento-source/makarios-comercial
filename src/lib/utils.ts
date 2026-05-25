import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateBR(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function calcInadimplencia(
  totalVencidos: number,
  faturamentoBruto: number
): number {
  if (faturamentoBruto === 0) return 0;
  return (totalVencidos / faturamentoBruto) * 100;
}

export function agingBucket(
  diasVencido: number
): "1-30" | "31-60" | "61-90" | "+90" {
  if (diasVencido <= 30) return "1-30";
  if (diasVencido <= 60) return "31-60";
  if (diasVencido <= 90) return "61-90";
  return "+90";
}
