import { useEffect, useMemo, useRef } from "react";
import type { FinanceData, Stats, ExpenseItem } from "@/types/finance";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPercentage } from "@/lib/formatPercentage";

const fmt = (v: number, currency: string) =>
  Math.round(v).toLocaleString("en-US") + " " + currency;

interface Props {
  data: FinanceData;
  stats: Stats;
  showPercent?: boolean;
  currency?: string;
  mobileZoom?: number;
}

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

export default function SankeyChart({ data, stats, showPercent = true, currency = "€", mobileZoom = 1 }: Props) {
  const isMobile = useIsMobile();
  const chartScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile || !chartScrollRef.current) return;

    const frame = requestAnimationFrame(() => {
      const container = chartScrollRef.current;
      if (container) {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isMobile, mobileZoom]);
  const svgContent = useMemo(() => {
    const tot = stats.income;
    if (tot <= 0) return null;

    const visCats = stats.cats.filter((c) => c.total > 0);
    const remaining = stats.remaining > 0.01 ? stats.remaining : 0;
    const isOverspending = stats.remaining < -0.01;
    const deficit = isOverspending ? Math.abs(stats.remaining) : 0;

    const allEntries = [
      ...visCats.map((c) => ({ ...c, visItems: c.items.filter((i) => (i.value || 0) > 0) })),
      ...(remaining > 0
        ? [{ id: "_ue", name: "Remaining", color: data.remainingColor || "#4DB6AC", total: remaining, items: [] as ExpenseItem[], visItems: [] as ExpenseItem[] }]
        : []),
    ];

    const totalVal = allEntries.reduce((s, e) => s + e.total, 0);
    if (totalVal <= 0) return null;

    // For overspending, normalize using total expenses instead of income
    const normalizeTotal = isOverspending ? totalVal : tot;

    const W = isMobile ? 550 : 1100;
    const colIncome = isMobile ? 36 : 160;
    const colCat = isMobile ? 220 : W * 0.38;
    const colItem = isMobile ? 400 : W * 0.72;

    const NODE_W_INCOME = 3;
    const NODE_W_CAT = isMobile ? 4 : 5;
    const NODE_W_ITEM = isMobile ? 4 : 7;
    const CAT_GAP = 6;
    const ITEM_GAP = 8;
    const MIN_H = 16;

    const allItems: { entry: typeof allEntries[0]; item?: ExpenseItem | null; h: number }[] = [];
    allEntries.forEach((entry) => {
      if (entry.visItems.length > 0) {
        entry.visItems.forEach((item) => {
          allItems.push({ entry, item, h: 0 });
        });
      } else {
        allItems.push({ entry, item: null, h: 0 });
      }
    });

    const totalItemRows = allItems.length;
    const totalItemGaps = (totalItemRows - 1) * ITEM_GAP;
    const catTotalGaps = (allEntries.length - 1) * CAT_GAP;
    const catAvailH_base = 260;
    const catAvailH = Math.max(catAvailH_base, totalItemRows * (MIN_H + ITEM_GAP));
    const MT = 8;

    type CNode = { id: string; name: string; color: string; total: number; y: number; h: number; visItems: ExpenseItem[] };
    const catNodes: CNode[] = [];
    let cy = MT;
    const catAreaH = catAvailH - catTotalGaps;
    allEntries.forEach((entry) => {
      const proportion = entry.total / totalVal;
      const h = Math.max(proportion * catAreaH, MIN_H);
      catNodes.push({ id: entry.id, name: entry.name, color: entry.color, total: entry.total, y: cy, h, visItems: entry.visItems });
      cy += h + CAT_GAP;
    });

    const catTopY = catNodes[0].y;
    const catBotY = catNodes[catNodes.length - 1].y + catNodes[catNodes.length - 1].h;
    const catSpan = catBotY - catTopY;
    const incomeSpan = catSpan * 0.65;
    const itemSpan = catSpan * 1.3;
    const incomeCenterY = catTopY + catSpan / 2;
    const itemCenterY = incomeCenterY;
    let itemStartY = itemCenterY - itemSpan / 2;

    let incomeY = incomeCenterY - incomeSpan / 2;
    const minY = Math.min(incomeY, MT, itemStartY);
    const yOffset = minY < MT ? MT - minY : 0;

    if (yOffset > 0) {
      incomeY += yOffset;
      itemStartY += yOffset;
      catNodes.forEach((cn) => {
        cn.y += yOffset;
      });
    }

    type INode = { id: string; name: string; value: number; color: string; y: number; h: number; catIdx: number };
    const itemNodes: INode[] = [];
    const itemAreaH = itemSpan - totalItemGaps;
    let iy = itemStartY;
    let itemIdx = 0;
    catNodes.forEach((cn, catIdx) => {
      if (cn.visItems.length > 0) {
        cn.visItems.forEach((item: ExpenseItem, itemSubIdx) => {
          const proportion = (item.value || 0) / totalVal;
          const h = Math.max(proportion * itemAreaH, MIN_H);
          itemNodes.push({
            id: item.id,
            name: item.name,
            value: item.value,
            color: getCategoryItemColor(cn.color, itemSubIdx, cn.visItems.length),
            y: iy,
            h,
            catIdx
          });
          iy += h + ITEM_GAP;
          itemIdx++;
        });
      } else {
        itemIdx++;
      }
    });

    const incomeH = incomeSpan;

    const shiftedCatBotY = catNodes[catNodes.length - 1].y + catNodes[catNodes.length - 1].h;
    const allBottom = Math.max(shiftedCatBotY, iy - ITEM_GAP, incomeY + incomeH);
    const H = allBottom + MT;

    const elements: JSX.Element[] = [];

    const flowPath = (
      x1: number, y1top: number, y1bot: number,
      x2: number, y2top: number, y2bot: number,
      color: string, opacity: number, key: string,
    ) => {
      const dx = x2 - x1;
      const cx1 = x1 + dx * 0.45;
      const cx2 = x2 - dx * 0.45;
      return (
        <path
          key={key}
          d={`M${x1},${y1top} C${cx1},${y1top} ${cx2},${y2top} ${x2},${y2top} L${x2},${y2bot} C${cx2},${y2bot} ${cx1},${y1bot} ${x1},${y1bot} Z`}
          fill={color}
          opacity={opacity}
        />
      );
    };

    const fsIncome = isMobile ? "12" : "13";
    const fsCat = isMobile ? "11" : "12";
    const fsItem = isMobile ? "10.5" : "11.5";
    const display = (val: number) => showPercent ? formatPercentage(val, tot) : fmt(val, currency);

    // Calculate segment data and resolved vertical label positions for each income
    const incomeLabels = data.income.map((inc, idx) => {
      const segmentH = (inc.value / normalizeTotal) * incomeH;
      const prevHSum = data.income.slice(0, idx).reduce((s, item) => s + (item.value / normalizeTotal) * incomeH, 0);
      const y = incomeY + prevHSum + segmentH / 2;
      return {
        id: inc.id || `inc-${idx}`,
        name: inc.name,
        value: inc.value,
        y,
        h: segmentH,
        yStart: incomeY + prevHSum,
      };
    });

    // Resolve vertical overlaps for income labels if there are multiple
    if (incomeLabels.length > 1) {
      const minIncSpacing = isMobile ? 22 : 24;
      for (let i = 1; i < incomeLabels.length; i++) {
        if (incomeLabels[i].y < incomeLabels[i - 1].y + minIncSpacing) {
          incomeLabels[i].y = incomeLabels[i - 1].y + minIncSpacing;
        }
      }
    }

    const getIncomeSegmentColor = (idx: number, isDeficit: boolean) => {
      if (isDeficit) {
        return getCategoryItemColor("#E53935", idx, data.income.length);
      } else {
        const baseColor = data.incomeColor || "#2196F3";
        return getCategoryItemColor(baseColor, idx, data.income.length);
      }
    };

    // Draw segmented income bar
    incomeLabels.forEach((il, idx) => {
      const segmentColor = getIncomeSegmentColor(idx, false);
      const x = colIncome;
      const y = il.yStart;
      const W = NODE_W_INCOME;
      const H = il.h;
      const R = isMobile ? 1 : 1.5;

      let pathD = "";
      if (isOverspending) {
        if (idx === 0) {
          // Rounded top-left, straight bottom-left
          pathD = `M ${x + R} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x} ${y + H} L ${x} ${y + R} A ${R} ${R} 0 0 1 ${x + R} ${y} Z`;
        } else {
          // Completely straight
          pathD = `M ${x} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x} ${y + H} Z`;
        }
      } else {
        if (incomeLabels.length === 1) {
          // Fully rounded left
          pathD = `M ${x + R} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x + R} ${y + H} A ${R} ${R} 0 0 1 ${x} ${y + H - R} L ${x} ${y + R} A ${R} ${R} 0 0 1 ${x + R} ${y} Z`;
        } else if (idx === 0) {
          // Rounded top-left, straight bottom-left
          pathD = `M ${x + R} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x} ${y + H} L ${x} ${y + R} A ${R} ${R} 0 0 1 ${x + R} ${y} Z`;
        } else if (idx === incomeLabels.length - 1) {
          // Rounded bottom-left, straight top-left
          pathD = `M ${x} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x + R} ${y + H} A ${R} ${R} 0 0 1 ${x} ${y + H - R} L ${x} ${y} Z`;
        } else {
          // Completely straight
          pathD = `M ${x} ${y} L ${x + W} ${y} L ${x + W} ${y + H} L ${x} ${y + H} Z`;
        }
      }

      elements.push(
        <path
          key={`income-segment-${il.id}`}
          d={pathD}
          fill={segmentColor}
          opacity={0.8}
        />
      );
    });

    // Draw deficit node if overspending
    if (isOverspending) {
      const deficitBarH = (deficit / normalizeTotal) * incomeH;
      const deficitYStart = incomeY + (tot / normalizeTotal) * incomeH;
      const x = colIncome;
      const W = NODE_W_INCOME;
      const H = deficitBarH;
      const R = isMobile ? 1 : 1.5;

      // Rounded bottom-left, straight top-left
      const pathD = `M ${x} ${deficitYStart} L ${x + W} ${deficitYStart} L ${x + W} ${deficitYStart + H} L ${x + R} ${deficitYStart + H} A ${R} ${R} 0 0 1 ${x} ${deficitYStart + H - R} L ${x} ${deficitYStart} Z`;

      elements.push(
        <path
          key="deficit-node"
          d={pathD}
          fill="#E53935"
          opacity={0.8}
        />
      );
    }

    // Render individual income labels
    incomeLabels.forEach((il, idx) => {
      const labelText = `${il.name}: ${display(il.value)}`;

      // If mobile and multiple incomes, space them horizontally (on x) and center them on y
      const labelX = isMobile
        ? colIncome - 12 - idx * 12
        : colIncome - 12;
      const labelY = isMobile
        ? incomeY + incomeH / 2
        : il.y;

      elements.push(
        <text
          key={`il-${il.id}`}
          x={labelX}
          y={labelY}
          textAnchor={isMobile ? "middle" : "end"}
          dominantBaseline="middle"
          fontSize={fsIncome}
          fontWeight="600"
          className="fill-foreground"
          fontFamily="'Space Grotesk',sans-serif"
          transform={isMobile ? `rotate(-90, ${labelX}, ${labelY})` : undefined}
        >
          {labelText}
        </text>
      );
    });

    // Add deficit indicator next to deficit node if overspending
    if (isOverspending) {
      const deficitBarH = (deficit / normalizeTotal) * incomeH;
      const deficitYStart = incomeY + (tot / normalizeTotal) * incomeH;
      const labelY = isMobile
        ? incomeY + incomeH / 2
        : deficitYStart + deficitBarH / 2;
      const labelX = isMobile
        ? colIncome - 12 - incomeLabels.length * 12
        : colIncome - 12;

      elements.push(
        <text
          key="deficit-warning"
          x={labelX}
          y={labelY}
          textAnchor={isMobile ? "middle" : "end"}
          dominantBaseline="middle"
          fontSize={isMobile ? "9.5" : "10"}
          className="fill-destructive font-bold"
          fontFamily="'Space Grotesk',sans-serif"
          transform={isMobile ? `rotate(-90, ${labelX}, ${labelY})` : undefined}
        >
          Deficit: {display(deficit)}
        </text>
      );
    }

    let incomeOff = incomeY;
    catNodes.forEach((cn, i) => {
      const flowH = (cn.total / (isOverspending ? totalVal : tot)) * incomeH;
      elements.push(flowPath(
        colIncome + NODE_W_INCOME, incomeOff, incomeOff + flowH,
        colCat, cn.y, cn.y + cn.h,
        cn.color, 0.28, `flow-ic-${i}`,
      ));
      incomeOff += flowH;
    });

    catNodes.forEach((cn, catIdx) => {
      elements.push(
        <rect key={`cb-${cn.id}`} x={colCat} y={cn.y} width={NODE_W_CAT} height={cn.h} fill={cn.color} opacity={0.8} />,
      );

      const catItems = itemNodes.filter((n) => n.catIdx === catIdx);

      if (catItems.length > 0) {
        elements.push(
          <text
            key={`cl-${cn.id}`}
            x={colCat + NODE_W_CAT + (isMobile ? 8 : 12)}
            y={cn.y + cn.h / 2}
            dominantBaseline="middle"
            fontSize={fsCat}
            fontWeight="600"
            className="fill-foreground"
            fontFamily="'Space Grotesk',sans-serif"
          >
            {cn.name}: {display(cn.total)}
          </text>,
        );

        const catItemTotal = catItems.reduce((s, it) => s + (it.value || 0), 0);
        let catFlowOff = cn.y;
        catItems.forEach((item, idx) => {
          const flowProp = catItemTotal > 0 ? (item.value / catItemTotal) * cn.h : cn.h / catItems.length;
          elements.push(flowPath(
            colCat + NODE_W_CAT, catFlowOff, catFlowOff + flowProp,
            colItem, item.y, item.y + item.h,
            item.color, 0.22, `flow-ci-${cn.id}-${idx}`,
          ));
          catFlowOff += flowProp;

          const x = colItem;
          const y = item.y;
          const W = NODE_W_ITEM;
          const H = item.h;
          const R = 3;

          elements.push(
            <path
              key={`ib-${item.id}`}
              d={`M ${x} ${y} L ${x + W - R} ${y} A ${R} ${R} 0 0 1 ${x + W} ${y + R} L ${x + W} ${y + H - R} A ${R} ${R} 0 0 1 ${x + W - R} ${y + H} L ${x} ${y + H} Z`}
              fill={item.color}
              opacity={0.8}
            />
          );

          elements.push(
            <text
              key={`itl-${item.id}`}
              x={colItem + NODE_W_ITEM + (isMobile ? 10 : 16)}
              y={item.y + item.h / 2}
              dominantBaseline="middle"
              fontSize={fsItem}
              className="fill-foreground"
              fontFamily="'Space Grotesk',sans-serif"
            >
              {item.name}: <tspan fontWeight="600">{display(item.value)}</tspan>
            </text>,
          );
        });
      } else {
        elements.push(
          <text
            key={`cl-${cn.id}`}
            x={colCat + NODE_W_CAT + (isMobile ? 8 : 12)}
            y={cn.y + cn.h / 2}
            dominantBaseline="middle"
            fontSize={fsCat}
            fontWeight="600"
            className="fill-foreground"
            fontFamily="'Space Grotesk',sans-serif"
          >
            {cn.name}: {display(cn.total)}
          </text>,
        );
      }
    });

    const startX = isMobile ? -25 : 0;
    const viewW = isMobile ? W + 25 : W;
    return { W: viewW, H, startX, elements };
  }, [data, stats, showPercent, currency, isMobile]);

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }
  return (
    <div ref={chartScrollRef} className="relative w-full h-full overflow-x-auto overflow-y-hidden flex items-center justify-start md:justify-center p-2">
      {isMobile && (
        <div className="hidden absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {}}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Zoom out flow chart"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="min-w-10 rounded-md px-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Reset flow chart zoom"
          >
            {Math.round(mobileZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Zoom in flow chart"
          >
            +
          </button>
        </div>
      )}
      <div
        className="w-full h-full max-w-[650px] md:max-w-none flex-shrink-0"
        style={isMobile ? { width: `${mobileZoom * 100}%`, maxWidth: "none" } : undefined}
      >
        <svg viewBox={`${svgContent.startX} 0 ${svgContent.W} ${svgContent.H}`} className="w-full h-full max-h-full" preserveAspectRatio="xMidYMid meet">
          {svgContent.elements}
        </svg>
      </div>
    </div>
  );
}
