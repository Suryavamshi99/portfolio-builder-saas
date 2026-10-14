import * as React from "react";
import { generateQrMatrix } from "./qr-matrix";

export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const matrix = React.useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (matrix.length === 0) return null;
  const n = matrix.length;

  let pathD = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r]![c]) {
        pathD += `M${c},${r}h1v1h-1z `;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      className="rounded bg-white p-2 shadow-sm"
      shapeRendering="crispEdges"
      aria-label="QR Code"
    >
      <path d={pathD} fill="#000000" />
    </svg>
  );
}
