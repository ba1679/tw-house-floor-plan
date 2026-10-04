"use client";

export function PrintChecklistButton({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}>列印清單</button>;
}
