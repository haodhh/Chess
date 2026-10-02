import { useEffect, useRef, useState } from 'react';

const HEIGHT = 120;

/**
 * White's winning chances (0–100) after each position; clicking selects a ply.
 * `marks` colours individual points (e.g. blunders).
 */
export function EvalGraph({
  values,
  current,
  onSelect,
  marks,
}: {
  values: number[];
  current: number;
  onSelect: (index: number) => void;
  marks?: Map<number, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (values.length < 2) return null;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => HEIGHT - (v / 100) * HEIGHT;
  const area = `M0,${HEIGHT} ${values.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L${width},${HEIGHT} Z`;
  const indexAt = (clientX: number, rect: DOMRect) =>
    Math.max(0, Math.min(values.length - 1, Math.round(((clientX - rect.left) / rect.width) * (values.length - 1))));
  const shown = hover ?? current;

  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-lg bg-[#403d39]">
      <svg
        width={width}
        height={HEIGHT}
        className="block cursor-pointer touch-none"
        role="img"
        aria-label="Biểu đồ đánh giá ván cờ"
        onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSelect(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
      >
        <path d={area} fill="#e7e5e4" />
        <line x1={0} x2={width} y1={HEIGHT / 2} y2={HEIGHT / 2} stroke="rgba(128,128,128,0.6)" />
        {marks &&
          [...marks].map(([i, color]) => (
            <circle key={i} cx={x(i)} cy={y(values[i])} r={4} fill={color} stroke="#403d39" strokeWidth={2} />
          ))}
        <line x1={x(shown)} x2={x(shown)} y1={0} y2={HEIGHT} stroke="#81b64c" strokeWidth={2} />
      </svg>
    </div>
  );
}
