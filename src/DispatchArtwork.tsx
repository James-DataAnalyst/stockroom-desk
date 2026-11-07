import { useEffect, useRef } from "react";

const parcels = [
  {
    name: "rear",
    x: 345,
    y: 70,
    side: 80,
    height: 78,
    degrees: -12,
    delay: 420,
    top: "#4b5142",
    left: "#30372d",
    right: "#3c4436",
    edge: "#929b81",
    tape: "#bdc4a0",
    tapeOpacity: 0.26,
  },
  {
    name: "right",
    x: 443,
    y: 110.5,
    side: 68,
    height: 64,
    degrees: 16,
    delay: 250,
    top: "#5a604d",
    left: "#383e32",
    right: "#494f3f",
    edge: "#a9ae90",
    tape: "#c2c6a4",
    tapeOpacity: 0.3,
  },
  {
    name: "front",
    x: 251,
    y: 138,
    side: 55,
    height: 49,
    degrees: 22,
    delay: 70,
    top: "#e38e6a",
    left: "#a95136",
    right: "#bc6848",
    edge: "#eea485",
    tape: "#ffbc9e",
    tapeOpacity: 0.64,
  },
] as const;

type Parcel = (typeof parcels)[number];
const turnDuration = 3400;
const sequenceEnd =
  turnDuration + Math.max(...parcels.map((parcel) => parcel.delay));

function projectFaces({ x, y, side }: Parcel, yaw: number) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // Rotate the two floor axes about the box centre, then project them into the warehouse view.
  const rightX = cos - sin;
  const rightY = 0.54 * (cos + sin);
  const leftX = -cos - sin;
  const leftY = 0.54 * (cos - sin);
  const halfWidth = ((rightX + leftX) * side) / 2;
  const halfDepth = ((rightY + leftY) * side) / 2;
  const backX = x - halfWidth;
  const backY = y - halfDepth;

  return [
    `matrix(${rightX} ${rightY} ${leftX} ${leftY} ${backX} ${backY})`,
    `matrix(${rightX} ${rightY} 0 1 ${backX + leftX * side} ${backY + leftY * side})`,
    `matrix(${-leftX} ${-leftY} 0 1 ${x + halfWidth} ${y + halfDepth})`,
  ];
}

function Carton({ parcel }: { parcel: Parcel }) {
  const { name, side, height, edge, tape, tapeOpacity } = parcel;
  const [top, left, right] = projectFaces(parcel, 0);
  const tapeInset = side * 0.3;
  const tapeWidth = side * 0.18;
  const labelX = side * 0.14;
  const labelY = height * 0.38;
  const labelWidth = side * 0.34;
  const labelHeight = height * 0.25;

  return (
    <g
      data-parcel={name}
      stroke={edge}
      strokeWidth="1.15"
      strokeLinejoin="round"
    >
      <g data-face="top" transform={top}>
        <rect width={side} height={side} fill={parcel.top} />
        <rect
          y={tapeInset}
          width={side}
          height={tapeWidth}
          fill={tape}
          fillOpacity={tapeOpacity}
          strokeWidth=".8"
        />
      </g>
      <g data-face="left" transform={left}>
        <rect width={side} height={height} fill={parcel.left} />
        <rect
          x={labelX}
          y={labelY}
          width={labelWidth}
          height={labelHeight}
          fill={tape}
          fillOpacity=".2"
          strokeWidth=".8"
          strokeOpacity=".7"
        />
        <path
          d={`M ${labelX + labelWidth * 0.18} ${labelY + labelHeight * 0.34} h ${labelWidth * 0.64}
        m ${-labelWidth * 0.64} ${labelHeight * 0.27} h ${labelWidth * 0.48}`}
          fill="none"
          stroke={tape}
          strokeWidth=".85"
        />
      </g>
      <g data-face="right" transform={right}>
        <rect width={side} height={height} fill={parcel.right} />
        <rect
          x={side - tapeInset - tapeWidth}
          width={tapeWidth}
          height={height * 0.37}
          fill={tape}
          fillOpacity={tapeOpacity}
          strokeWidth=".8"
        />
      </g>
    </g>
  );
}

export function DispatchArtwork() {
  const artwork = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = artwork.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!svg || reducedMotion.matches) return;

    const faces = [...svg.querySelectorAll("[data-parcel]")].map((parcel) => [
      ...parcel.querySelectorAll("[data-face]"),
    ]);
    let frame: number;
    let start: number | undefined;

    function draw(elapsed: number) {
      parcels.forEach((parcel, index) => {
        const progress = Math.min(
          1,
          Math.max(0, (elapsed - parcel.delay) / turnDuration),
        );
        const yaw =
          ((parcel.degrees * Math.PI) / 180) *
          Math.sin(Math.PI * progress) ** 2;
        projectFaces(parcel, yaw).forEach((transform, face) =>
          faces[index][face].setAttribute("transform", transform),
        );
      });
    }

    function animate(now: number) {
      start ??= now;
      const elapsed = (now - start) % sequenceEnd;
      draw(elapsed);
      frame = requestAnimationFrame(animate);
    }

    function stop() {
      cancelAnimationFrame(frame);
      draw(0);
    }

    frame = requestAnimationFrame(animate);
    reducedMotion.addEventListener("change", stop);
    return () => {
      stop();
      reducedMotion.removeEventListener("change", stop);
    };
  }, []);

  return (
    <div className="dispatch-art" aria-hidden="true">
      <svg
        ref={artwork}
        width="575"
        height="240"
        viewBox="0 0 575 240"
        focusable="false"
      >
        {parcels.map((parcel) => (
          <Carton parcel={parcel} key={parcel.name} />
        ))}
      </svg>
    </div>
  );
}
