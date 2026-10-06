import { useMemo } from "react";
import type { FinanceData, Stats } from "@/types/finance";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  data: FinanceData;
  stats: Stats;
  currency?: string;
  showPercent?: boolean;
}

// Larger viewbox to accommodate labels
const size = 800;
const center = size / 2;
const outerRadius = 230;
const innerRadius = 140;
const labelRadius = 290;

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const createArcPath = (
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, outerR, endAngle);
  const end = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    `Z`,
  ].join(" ");
};

const getCategoryItemColor = (catColor: string, itemIndex: number, totalItems: number): string => {
  if (totalItems <= 1) return catColor;

  // Simple Hex to RGB
  let hex = catColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Convert RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }

  // Safe margin around base lightness: linear distribution from (l - 0.10) to (l + 0.10)
  const minL = Math.max(0.12, l - 0.10);
  const maxL = Math.min(0.88, l + 0.10);
  
  const newL = totalItems > 1 
    ? minL + (itemIndex / (totalItems - 1)) * (maxL - minL)
    : l;

  // Convert HSL back to RGB
  let newR, newG, newB;
  if (s === 0) {
    newR = newG = newB = newL; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const str = Math.round(x * 255).toString(16);
    return str.length === 1 ? "0" + str : str;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

const getDonutLabelColor = (backgroundColor: string) => {
  let hex = backgroundColor.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((value) => value + value).join("");
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (!/^[\da-f]{6}$/i.test(hex)) return "hsl(var(--foreground))";

  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linearize = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  const darkContrast = (luminance + 0.05) / 0.05;
  const lightContrast = 1.05 / (luminance + 0.05);

  return darkContrast >= lightContrast ? "#111827" : "#FFFFFF";
};

export default function DonutChart({ data, stats, currency = "€", showPercent = false }: Props) {
  const isMobile = useIsMobile();
  const { segments, mobileSegments, total, centerText, centerLabel, isOverspending } = useMemo(() => {
    const fmt = (v: number) => Math.round(v).toLocaleString("en-US") + " " + currency;

    // Flatten all items from all categories
    const allItems: { id: string; name: string; value: number; color: string; catName: string }[] = [];
    const categoryTotals: { id: string; name: string; value: number; color: string }[] = [];
    let totalExpenses = 0;

    stats.cats.forEach((cat) => {
      const visItems = cat.items.filter((item) => item.value > 0);
      const categoryTotal = visItems.reduce((sum, item) => sum + item.value, 0);

      if (categoryTotal > 0) {
        categoryTotals.push({
          id: cat.id,
          name: cat.name,
          value: categoryTotal,
          color: cat.color,
        });
      }

      visItems.forEach((item, itemIdx) => {
        allItems.push({
          id: item.id,
          name: item.name,
          value: item.value,
          color: getCategoryItemColor(cat.color, itemIdx, visItems.length),
          catName: cat.name,
        });
        totalExpenses += item.value;
      });
    });

    const remaining = stats.income - totalExpenses;
    const isOverspending = remaining < 0;

    // Total for normalization - use actual total expenses so chart always fits 360°
    const totalForChart = totalExpenses + Math.max(0, remaining);

    const createSegments = (
      items: { id: string; name: string; value: number; color: string; catName?: string }[],
    ) => {
      let currentAngle = -90; // Start from top
      const chartSegments = items.map((item) => {
        const angle = totalForChart > 0 ? (item.value / totalForChart) * 360 : 0;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle += angle;

        return {
          id: item.id,
          name: item.name,
          catName: item.catName || "",
          color: item.color,
          total: item.value,
          startAngle,
          endAngle,
          percentage: totalForChart > 0 ? Math.round((item.value / totalForChart) * 100) : 0,
        };
      });

      // Add remaining segment if surplus (remaining > 0)
      if (remaining > 0.01) {
        const angle = (remaining / totalForChart) * 360;
        chartSegments.push({
          id: "_remaining",
          name: "Remaining",
          catName: "",
          color: data.remainingColor || "#4DB6AC",
          total: remaining,
          startAngle: currentAngle,
          endAngle: currentAngle + angle,
          percentage: Math.round((remaining / totalForChart) * 100),
        });
      }

      return chartSegments;
    };

    const segments = createSegments(allItems);
    const sortedCategories = [...categoryTotals].sort((a, b) => b.value - a.value);
    const mainCategories = sortedCategories.slice(0, 4);
    const otherTotal = sortedCategories.slice(4).reduce((sum, category) => sum + category.value, 0);
    const mobileItems = mainCategories.map((category) => ({
      ...category,
      catName: "",
    }));

    if (otherTotal > 0) {
      mobileItems.push({
        id: "_other",
        name: "Other",
        value: otherTotal,
        color: "hsl(var(--muted-foreground))",
        catName: "",
      });
    }

    const mobileSegments = createSegments(mobileItems);

    const centerText = isOverspending
      ? (showPercent
          ? (stats.income > 0 ? `-${Math.round((Math.abs(remaining) / stats.income) * 100)}%` : "0%")
          : `-${fmt(Math.abs(remaining))}`)
      : (showPercent
          ? (stats.income > 0 ? "100%" : "0%")
          : fmt(stats.income));

    const centerLabel = isOverspending ? "Deficit" : "Total Income";

    return {
      segments,
      mobileSegments,
      total: stats.income,
      isOverspending,
      centerText,
      centerLabel,
    };
  }, [data.remainingColor, stats, currency, showPercent]);

  // Sort and adjust label positions to prevent vertical overlaps
  const labels = useMemo(() => {
    const visibleSegments = segments.filter(seg => seg.total > 0);
    
    const labelData = visibleSegments.map(seg => {
      const midAngle = (seg.startAngle + seg.endAngle) / 2;
      const pos = polarToCartesian(center, center, labelRadius, midAngle);
      const isRightSide = midAngle > -90 && midAngle < 90;
      return {
        seg,
        midAngle,
        isRightSide,
        x: pos.x,
        y: pos.y
      };
    });

    const minSpacing = 40; // Minimum vertical spacing in pixels to prevent overlap (increased for larger fonts)

    // Adjust Right Side labels (top to bottom)
    const rightLabels = labelData.filter(l => l.isRightSide).sort((a, b) => a.y - b.y);
    for (let i = 1; i < rightLabels.length; i++) {
      if (rightLabels[i].y < rightLabels[i - 1].y + minSpacing) {
        rightLabels[i].y = rightLabels[i - 1].y + minSpacing;
      }
    }

    // Adjust Left Side labels (top to bottom)
    const leftLabels = labelData.filter(l => !l.isRightSide).sort((a, b) => a.y - b.y);
    for (let i = 1; i < leftLabels.length; i++) {
      if (leftLabels[i].y < leftLabels[i - 1].y + minSpacing) {
        leftLabels[i].y = leftLabels[i - 1].y + minSpacing;
      }
    }

    return [...rightLabels, ...leftLabels];
  }, [segments]);

  if (total <= 0 || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  const chartSegments = isMobile ? mobileSegments : segments;
  const formatMobileValue = (segment: (typeof mobileSegments)[number]) =>
    showPercent
      ? `${segment.percentage}%`
      : `${new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(segment.total)} ${currency}`;

  const getMobileLabelRotation = (midAngle: number) => {
    let rotation = midAngle + 90;
    while (rotation > 90) rotation -= 180;
    while (rotation < -90) rotation += 180;
    return rotation;
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-6 overflow-y-auto p-2 md:p-4">
      <div className="w-full max-w-[360px] md:max-w-[680px] aspect-square flex items-center justify-center shrink-0">
        <svg
          viewBox={isMobile ? "160 160 480 480" : `0 0 ${size} ${size}`}
          className="w-full h-full"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            opacity="0.3"
          />

          {/* Segments */}
          {chartSegments.map((seg) => (
            <g key={seg.id}>
              <path
                d={createArcPath(
                  center,
                  center,
                  innerRadius,
                  outerRadius,
                  seg.startAngle,
                  seg.endAngle
                )}
                fill={seg.color}
                stroke="hsl(var(--background))"
                strokeWidth="2"
                className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                opacity={0.8}
              />
            </g>
          ))}

          {/* Center text */}
          <text
            x={center}
            y={center - 12}
            textAnchor="middle"
            dominantBaseline="middle"
            className={isOverspending ? "fill-destructive font-bold" : "fill-foreground"}
            fontSize="32"
            fontWeight="700"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {centerText}
          </text>
          <text
            x={center}
            y={center + 22}
            textAnchor="middle"
            dominantBaseline="middle"
            className={isOverspending ? "fill-destructive/80 font-bold" : "fill-muted-foreground"}
            fontSize="15"
            fontWeight="500"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {centerLabel}
          </text>

          {/* Labels - Only visible on desktop */}
          {!isMobile && labels.map(({ seg, midAngle, isRightSide, x, y }) => {
            const clampedY = Math.max(40, Math.min(size - 40, y));
            return (
              <g key={`label-${seg.id}`}>
                <line
                  x1={polarToCartesian(center, center, outerRadius + 3, midAngle).x}
                  y1={polarToCartesian(center, center, outerRadius + 3, midAngle).y}
                  x2={x + (isRightSide ? 8 : -8)}
                  y2={clampedY}
                  stroke={seg.color}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
                <text
                  x={x + (isRightSide ? 12 : -12)}
                  y={clampedY - 8}
                  textAnchor={isRightSide ? "start" : "end"}
                  dominantBaseline="middle"
                  className="fill-foreground"
                  fontSize="16"
                  fontWeight="600"
                  fontFamily="'Space Grotesk', sans-serif"
                >
                  {seg.name}
                </text>
                <text
                  x={x + (isRightSide ? 12 : -12)}
                  y={clampedY + 12}
                  textAnchor={isRightSide ? "start" : "end"}
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  fontSize="14"
                  fontFamily="'Space Grotesk', sans-serif"
                >
                  {showPercent ? `${seg.percentage}%` : `${seg.total.toLocaleString("en-US")} ${currency}`}
                </text>
              </g>
            );
          })}

          {isMobile && mobileSegments.map((seg) => {
            const midAngle = (seg.startAngle + seg.endAngle) / 2;
            const angle = seg.endAngle - seg.startAngle;
            const label = formatMobileValue(seg);
            const labelWidth = label.length * 8;
            const minAngle = ((labelWidth + 12) / 185) * (180 / Math.PI);

            // Leave narrow slices uncluttered; the category key below still names them.
            if (angle < minAngle) return null;

            const position = polarToCartesian(center, center, 185, midAngle);
            const rotation = getMobileLabelRotation(midAngle);

            return (
              <g key={`mobile-label-${seg.id}`} aria-label={`${seg.name}: ${label}`}>
                <text
                  x={position.x}
                  y={position.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rotation}, ${position.x}, ${position.y})`}
                  fill={getDonutLabelColor(seg.color)}
                  fontSize="18"
                  fontWeight="700"
                  fontFamily="'Space Grotesk', sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Compact category key for mobile */}
      {isMobile && (
        <div className="flex w-full max-w-[360px] flex-col items-center gap-2 border-t border-border/40 px-3 pt-4">
          {mobileSegments.map((seg) => (
            <div key={seg.id} className="flex min-h-9 min-w-0 items-center justify-center gap-3 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: seg.color, opacity: 0.9 }} />
              <span className="truncate font-semibold text-foreground">{seg.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
