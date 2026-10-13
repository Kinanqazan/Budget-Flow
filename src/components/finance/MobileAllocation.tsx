import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ExpenseItem, FinanceData, Stats } from "@/types/finance";

interface Props {
  data: FinanceData;
  stats: Stats;
  showPercent?: boolean;
  currency?: string;
}

interface Leaf {
  id: string;
  name: string;
  value: number;
  x: number;
  y: number;
  lines: string[];
  valueY: number;
  width: number;
}

interface Branch extends Leaf {
  titleY: number;
  color: string;
  expandable: boolean;
  expanded: boolean;
  items: ExpenseItem[];
  children: Leaf[];
  side: number;
  sourceX: number;
  flowWidth: number;
}

const formatMoney = (value: number, currency: string) =>
  `${Math.round(value).toLocaleString()} ${currency}`;

// Keep every label inside its half of the phone canvas.
function wrapLabel(name: string, width: number): string[] {
  const limit = Math.max(10, Math.floor(width / 6.4));
  const words = name.trim().split(/\s+/).flatMap((word) => {
    const parts: string[] = [];
    for (let index = 0; index < word.length; index += limit) parts.push(word.slice(index, index + limit));
    return parts;
  });
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= limit) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  if (lines.length > 2) return [lines[0], `${lines[1].slice(0, limit - 1)}…`];
  return lines.length ? lines : ["Untitled"];
}

function branchPath(branch: Branch, sourceY: number): string {
  const sourceX = branch.sourceX + branch.flowWidth / 2;
  const turnY = branch.y - 76;
  return `M ${sourceX} ${sourceY}
    L ${sourceX} ${turnY}
    C ${sourceX} ${turnY + 38}, ${branch.x} ${branch.y - 38}, ${branch.x} ${branch.y}`;
}

export default function MobileAllocation({ data, stats, showPercent = true, currency = "€" }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [width, setWidth] = useState(360);
  const chartRef = useRef<HTMLDivElement>(null);
  const diagramId = useId().replace(/:/g, "");
  const hasIncome = stats.income > 0;
  const overBudget = stats.remaining < -0.01;
  const incomeColor = data.incomeColor || "#60a5fa";
  const sourceY = overBudget ? 92 : 68;
  const formatValue = (value: number) => showPercent
    ? (hasIncome ? `${Math.round((value / stats.income) * 100)}%` : "—")
    : formatMoney(value, currency);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const measure = () => setWidth(chart.getBoundingClientRect().width || 360);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(chart);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [hasIncome]);

  const tree = useMemo(() => {
    const entries = [
      ...stats.cats.filter((category) => category.total > 0).sort((a, b) => b.total - a.total)
        .map((category) => ({ ...category, expandable: true })),
      ...(stats.remaining > 0.01 ? [{
        id: "_remaining", name: "Remaining", total: stats.remaining,
        color: data.remainingColor || "#4DB6AC", items: [] as ExpenseItem[], expandable: false,
      }] : []),
    ];
    const labelWidth = Math.min(150, width * 0.32);
    let nextY = sourceY + 132;
    const branches: Branch[] = [];
    for (let row = 0; row < entries.length; row += 2) {
      const pair = entries.slice(row, row + 2);
      const pairLines = pair.map((entry) => wrapLabel(entry.name, labelWidth));
      const rowLineCount = Math.max(...pairLines.map((lines) => lines.length));
      const rowBranches = pair.map((entry, index) => {
        const side = pair.length === 1 ? 0 : index === 0 ? -1 : 1;
        const x = width * (side === -1 ? 0.20 : side === 1 ? 0.80 : 0.5);
        const lines = pairLines[index];
        const titleY = nextY + 24 + (rowLineCount - lines.length) * 8;
        const valueY = nextY + 24 + rowLineCount * 16;
        const expanded = expandedCategory === entry.id;
        const items = entry.items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
        let childY = valueY + 140;
        const children = expanded ? items.map((item) => {
          const childLines = wrapLabel(item.name, labelWidth - 6);
          const child: Leaf = {
            id: item.id, name: item.name, value: item.value, x, y: childY,
            lines: childLines, valueY: childY + 20 + childLines.length * 15, width: labelWidth - 6,
          };
          childY = child.valueY + 42;
          return child;
        }) : [];
        return {
          id: entry.id, name: entry.name, value: entry.total, color: entry.color,
          x, y: nextY, lines, titleY, valueY, width: labelWidth, side,
          expandable: entry.expandable, expanded, items, children,
          sourceX: 0, flowWidth: 0,
        };
      });
      branches.push(...rowBranches);
      nextY = Math.max(...rowBranches.map((branch) =>
        branch.children.length ? branch.children[branch.children.length - 1].valueY : branch.valueY)) + 112;
    }

    // Put the first leaves at the outer edges of the source bundle. Later
    // branches stay in the central channel until they reach their own leaf.
    const sourceOrder = [
      ...branches.filter((branch) => branch.side <= 0),
      ...branches.filter((branch) => branch.side > 0).reverse(),
    ];
    const total = branches.reduce((sum, branch) => sum + branch.value, 0);
    // After the first fork, all remaining lanes must fit between the labels.
    const firstLeft = branches.find((branch) => branch.side < 0)?.value || 0;
    const firstRight = branches.find((branch) => branch.side > 0)?.value || 0;
    const outerRemaining = total > 0 ? Math.max(0.5 - firstLeft / total, 0.5 - firstRight / total, 0) : 0;
    const safeWidth = branches.length > 2 && outerRemaining > 0 ? width * 0.13 / outerRemaining : width;
    const bundleWidth = Math.min(144, width * 0.42, safeWidth);
    const gap = branches.length > 1 ? Math.min(3, bundleWidth / (branches.length * 5)) : 0;
    const totalGaps = gap * Math.max(0, branches.length - 1);
    let sourceX = width / 2 - bundleWidth / 2;
    sourceOrder.forEach((branch) => {
      const share = total > 0 ? branch.value / total : 0;
      branch.sourceX = sourceX;
      branch.flowWidth = share * (bundleWidth - totalGaps);
      sourceX += branch.flowWidth + gap;
    });
    return { branches, bundleWidth, height: Math.max(250, nextY - 72) };
  }, [stats.cats, stats.remaining, data.remainingColor, expandedCategory, sourceY, width]);

  const toggleCategory = (id: string) => setExpandedCategory((current) => current === id ? null : id);

  return (
    <div className="mx-auto w-full max-w-xl pb-5">
      <header className="mb-3 flex h-10 items-center">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Money flow</h1>
      </header>
      {!hasIncome ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Add income to see how it flows into your categories.
        </div>
      ) : (
        <div ref={chartRef} className="w-full">
          <svg
            role="group"
            aria-label="Money flow tree"
            width="100%"
            height={tree.height}
            viewBox={`0 0 ${width} ${tree.height}`}
            className="block overflow-visible"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <defs>
              {tree.branches.map((branch, index) => (
                <linearGradient key={branch.id} id={`${diagramId}-branch-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={branch.color} stopOpacity="0.60" />
                  <stop offset="100%" stopColor={branch.color} stopOpacity="0.80" />
                </linearGradient>
              ))}
            </defs>

            <g aria-hidden="true">
              {tree.branches.map((branch, index) => (
                <path
                  key={branch.id}
                  d={branchPath(branch, sourceY)}
                  fill="none"
                  stroke={`url(#${diagramId}-branch-${index})`}
                  strokeWidth={branch.flowWidth}
                  strokeLinecap="butt"
                />
              ))}
            </g>

            <text x={width / 2} y={20} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-muted-foreground">Income</text>
            <text x={width / 2} y={43} textAnchor="middle" fontSize="19" fontWeight="700" className="fill-foreground font-display">
              {formatValue(stats.income)}
            </text>
            {overBudget && (
              <text x={width / 2} y={65} textAnchor="middle" fontSize="11" fontWeight="600" className="fill-destructive">
                Over budget · {formatValue(Math.abs(stats.remaining))}
              </text>
            )}
            <rect x={width / 2 - tree.bundleWidth / 2} y={sourceY - 6} width={tree.bundleWidth} height="6" rx="3" fill={incomeColor} />
            {overBudget && (
              <rect
                x={width / 2 + tree.bundleWidth / 2 - Math.abs(stats.remaining) / Math.max(1, stats.expenses + stats.investments) * tree.bundleWidth}
                y={sourceY - 6}
                width={Math.abs(stats.remaining) / Math.max(1, stats.expenses + stats.investments) * tree.bundleWidth}
                height="6" rx="2" className="fill-destructive"
              />
            )}

            {tree.branches.map((branch) => {
              const detailsId = `${diagramId}-items-${branch.id}`;
              const barWidth = Math.max(6, branch.flowWidth + 2);
              const childSide = branch.side || -1;
              const railX = branch.x - childSide * (branch.width / 2 - 2);
              const childSourceY = branch.valueY + 18;
              let childOffset = 0;
              const childFlows = branch.children.map((child) => {
                const shareWidth = branch.flowWidth * child.value / Math.max(1, branch.value);
                const startX = branch.x - childSide * (branch.flowWidth / 2 - childOffset - shareWidth / 2);
                childOffset += shareWidth;
                const turnY = Math.max(childSourceY + 60, child.y - 60);
                return {
                  child,
                  width: Math.max(1.2, shareWidth),
                  path: `M ${startX} ${childSourceY} C ${startX} ${childSourceY + 30}, ${railX} ${childSourceY + 30}, ${railX} ${childSourceY + 60} L ${railX} ${turnY} C ${railX} ${child.y - 30}, ${child.x} ${child.y - 30}, ${child.x} ${child.y}`,
                };
              });
              return (
                <g key={branch.id}>
                  {branch.expanded && (
                    <g id={detailsId} role="list" aria-label={`${branch.name} items`}>
                      <rect
                        aria-hidden="true"
                        x={branch.x - branch.flowWidth / 2} y={childSourceY - 3}
                        width={branch.flowWidth} height="3" rx="1.5" fill={branch.color} fillOpacity="0.8"
                      />
                      <g aria-hidden="true" opacity="0.8">
                        {childFlows.map((flow) => (
                          <path key={flow.child.id} d={flow.path} fill="none" stroke={branch.color} strokeWidth={flow.width} strokeLinecap="butt" />
                        ))}
                      </g>
                      {childFlows.map(({ child, width: childWidth }) => {
                        return (
                          <g key={child.id} role="listitem" aria-label={`${child.name}: ${formatValue(child.value)}`}>
                            <rect x={child.x - (childWidth + 2) / 2} y={child.y} width={childWidth + 2} height="4" rx="2" fill={branch.color} fillOpacity="0.8" />
                            <text x={child.x} y={child.y + 20} textAnchor="middle" fontSize="11.5" className="fill-muted-foreground">
                              {child.lines.map((line, index) => <tspan key={index} x={child.x} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
                            </text>
                            <text x={child.x} y={child.valueY} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-foreground font-display">
                              {formatValue(child.value)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  <g
                    role={branch.expandable ? "button" : "group"}
                    aria-label={`${branch.name}: ${formatValue(branch.value)}${branch.expandable ? `, ${branch.expanded ? "collapse" : "expand"} ${branch.items.length} items` : ""}`}
                    aria-expanded={branch.expandable ? branch.expanded : undefined}
                    aria-controls={branch.expandable && branch.expanded ? detailsId : undefined}
                    tabIndex={branch.expandable ? 0 : undefined}
                    onClick={branch.expandable ? () => toggleCategory(branch.id) : undefined}
                    onKeyDown={branch.expandable ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleCategory(branch.id);
                      }
                    } : undefined}
                    className={branch.expandable ? "group cursor-pointer outline-none" : undefined}
                  >
                    <rect
                      x={branch.x - branch.width / 2} y={branch.y - 10}
                      width={branch.width} height={branch.valueY - branch.y + 24} rx="12"
                      className="fill-muted opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-60"
                    />
                    <rect x={branch.x - barWidth / 2} y={branch.y} width={barWidth} height="6" rx="3" fill={branch.color} />
                    <text x={branch.x} y={branch.titleY} textAnchor="middle" fontSize="13" fontWeight="600" className="fill-foreground">
                      {branch.lines.map((line, index) => <tspan key={index} x={branch.x} dy={index === 0 ? 0 : 16}>{line}</tspan>)}
                    </text>
                    <text x={branch.x} y={branch.valueY} textAnchor="middle" fontSize="14" fontWeight="700" fill={branch.color} className="font-display">
                      {formatValue(branch.value)}
                    </text>
                    {branch.expandable && (
                      <path
                        aria-hidden="true"
                        d={branch.expanded ? "M -3 2 L 0 -1 L 3 2" : "M -3 -1 L 0 2 L 3 -1"}
                        transform={`translate(${branch.x + branch.width / 2 - 12}, ${branch.valueY - 4})`}
                        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        className="text-muted-foreground"
                      />
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
