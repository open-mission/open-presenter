import type { PointerEvent as ReactPointerEvent } from "react";
import type { GuideAxis } from "./guides";

interface RulersProps {
  width: number;
  height: number;
  onStartGuide: (axis: GuideAxis, e: ReactPointerEvent<HTMLDivElement>) => void;
}

function RulerTicks({
  length,
  vertical,
}: {
  length: number;
  vertical: boolean;
}) {
  const step = 100;
  const ticks = [];
  for (let value = 0; value <= length; value += 20) {
    const isMajor = value % step === 0;
    const isMid = value % (step / 2) === 0;
    const size = isMajor ? 14 : isMid ? 9 : 5;
    ticks.push(
      <g key={value}>
        {vertical ? (
          <>
            <line
              x1={20 - size}
              y1={value}
              x2={20}
              y2={value}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            {isMajor && value > 0 && (
              <text
                x={11}
                y={value - 3}
                fill="rgba(255,255,255,0.7)"
                fontSize={9}
                fontFamily="monospace"
                transform={`rotate(-90, 11, ${value - 3})`}
              >
                {value}
              </text>
            )}
          </>
        ) : (
          <>
            <line
              x1={value}
              y1={20 - size}
              x2={value}
              y2={20}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            {isMajor && value > 0 && (
              <text
                x={value + 3}
                y={11}
                fill="rgba(255,255,255,0.7)"
                fontSize={9}
                fontFamily="monospace"
              >
                {value}
              </text>
            )}
          </>
        )}
      </g>,
    );
  }
  return <>{ticks}</>;
}

export function Rulers({ width, height, onStartGuide }: RulersProps) {
  return (
    <>
      <div
        className="absolute top-0 left-0 right-0 z-40 h-5 cursor-crosshair select-none border-b border-border/70 bg-card/85"
        title="Arraste para criar uma guia vertical"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0) return;
          onStartGuide("x", e);
        }}
      >
        <svg width={width} height={20} className="pointer-events-none h-full w-full">
          <RulerTicks length={width} vertical={false} />
        </svg>
      </div>
      <div
        className="absolute top-0 bottom-0 left-0 z-40 w-5 cursor-crosshair select-none border-r border-border/70 bg-card/85"
        title="Arraste para criar uma guia horizontal"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0) return;
          onStartGuide("y", e);
        }}
      >
        <svg width={20} height={height} className="pointer-events-none h-full w-full">
          <RulerTicks length={height} vertical />
        </svg>
      </div>
    </>
  );
}
