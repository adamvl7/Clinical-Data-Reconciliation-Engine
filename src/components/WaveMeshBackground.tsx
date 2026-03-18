/**
 * Layered background matching the Onye corporate website aesthetic:
 * gradient base, soft colour orbs, wire-mesh line bundles, and
 * decorative organic shapes.
 */
export default function WaveMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient — light mint with warm-white center */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#e2f5f1] via-[#f4fdfb] to-[#ddf0ec]" />

      {/* ── Soft colour orbs (radial blurs) ── */}
      {/* Top-left blue-purple wash */}
      <div
        className="absolute rounded-full blur-[120px] opacity-30"
        style={{
          width: 520,
          height: 520,
          top: -120,
          left: -100,
          background: "radial-gradient(circle, #b8cff6 0%, transparent 70%)",
        }}
      />
      {/* Large lavender sweep — upper-center to right (like Onye hero) */}
      <div
        className="absolute blur-[140px] opacity-25"
        style={{
          width: 900,
          height: 500,
          top: -60,
          right: -80,
          borderRadius: "50% 40% 60% 50%",
          background: "radial-gradient(ellipse at 60% 40%, #c7d0f4 0%, #d5d0f0 30%, transparent 70%)",
        }}
      />
      {/* Mid-left lavender band */}
      <div
        className="absolute blur-[120px] opacity-20"
        style={{
          width: 700,
          height: 400,
          top: "35%",
          left: -120,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 40% 50%, #c4bef0 0%, #d0cbf4 35%, transparent 70%)",
        }}
      />
      {/* Center-right warm teal glow */}
      <div
        className="absolute rounded-full blur-[100px] opacity-25"
        style={{
          width: 600,
          height: 600,
          top: "20%",
          right: -140,
          background: "radial-gradient(circle, #7ee8d4 0%, transparent 70%)",
        }}
      />
      {/* Bottom-left teal sphere */}
      <div
        className="absolute rounded-full blur-[80px] opacity-20"
        style={{
          width: 400,
          height: 400,
          bottom: -60,
          left: "5%",
          background: "radial-gradient(circle, #5ed4c2 0%, transparent 70%)",
        }}
      />
      {/* Bottom-right lavender */}
      <div
        className="absolute blur-[130px] opacity-22"
        style={{
          width: 650,
          height: 450,
          bottom: -100,
          right: -60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 50%, #c0b8f0 0%, #d2ccf6 30%, transparent 70%)",
        }}
      />
      {/* Bottom-center subtle lavender stripe */}
      <div
        className="absolute blur-[100px] opacity-15"
        style={{
          width: 800,
          height: 250,
          bottom: 40,
          left: "20%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #beb8e8 0%, transparent 70%)",
        }}
      />
      {/* Top-right white highlight */}
      <div
        className="absolute rounded-full blur-[90px] opacity-50"
        style={{
          width: 350,
          height: 350,
          top: "5%",
          right: "15%",
          background: "radial-gradient(circle, #ffffff 0%, transparent 70%)",
        }}
      />
      {/* Mid-left white fade */}
      <div
        className="absolute rounded-full blur-[100px] opacity-40"
        style={{
          width: 300,
          height: 300,
          top: "40%",
          left: "20%",
          background: "radial-gradient(circle, #ffffff 0%, transparent 70%)",
        }}
      />
      {/* Center white glow for breathing room */}
      <div
        className="absolute rounded-full blur-[110px] opacity-35"
        style={{
          width: 500,
          height: 400,
          top: "25%",
          left: "30%",
          background: "radial-gradient(circle, #ffffff 0%, transparent 65%)",
        }}
      />

      {/* ── Small solid floating circles (like Onye hero) ── */}
      <div
        className="absolute rounded-full opacity-40"
        style={{
          width: 32,
          height: 32,
          bottom: "18%",
          left: "8%",
          background: "#5ed4c2",
        }}
      />
      <div
        className="absolute rounded-full opacity-20"
        style={{
          width: 18,
          height: 18,
          top: "30%",
          right: "12%",
          background: "#3dbaa6",
        }}
      />
      <div
        className="absolute rounded-full opacity-15"
        style={{
          width: 24,
          height: 24,
          top: "12%",
          left: "35%",
          background: "#a8b4f0",
        }}
      />
      <div
        className="absolute rounded-full opacity-25"
        style={{
          width: 14,
          height: 14,
          top: "55%",
          right: "22%",
          background: "#b5b0e8",
        }}
      />
      <div
        className="absolute rounded-full opacity-18"
        style={{
          width: 20,
          height: 20,
          bottom: "25%",
          left: "42%",
          background: "#c0baf0",
        }}
      />

      {/* ── Wire-mesh SVG lines ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bundle 1: Upper-left sweep */}
        <g stroke="rgba(58,186,166,0.10)" strokeWidth="0.6">
          {Array.from({ length: 22 }, (_, i) => {
            const offset = i * 14;
            const y1 = -60 + offset;
            const cp1y = 120 + offset * 0.8;
            const cp2y = 300 + offset * 0.6;
            const y2 = 500 + offset * 0.4;
            return (
              <path
                key={`a${i}`}
                d={`M${-80 + i * 6},${y1} C${300 + i * 4},${cp1y} ${700 - i * 3},${cp2y} ${1520 - i * 5},${y2}`}
              />
            );
          })}
        </g>

        {/* Bundle 2: Lower-left sweep */}
        <g stroke="rgba(58,186,166,0.08)" strokeWidth="0.6">
          {Array.from({ length: 20 }, (_, i) => {
            const offset = i * 15;
            const y1 = 950 - offset;
            const cp1y = 700 - offset * 0.7;
            const cp2y = 400 - offset * 0.5;
            const y2 = 150 - offset * 0.3;
            return (
              <path
                key={`b${i}`}
                d={`M${-60 + i * 5},${y1} C${350 + i * 3},${cp1y} ${800 - i * 4},${cp2y} ${1500 - i * 3},${y2}`}
              />
            );
          })}
        </g>

        {/* Bundle 3: Top-right flowing down-left */}
        <g stroke="rgba(45,170,152,0.07)" strokeWidth="0.5">
          {Array.from({ length: 18 }, (_, i) => {
            const offset = i * 16;
            const x1 = 1500 - offset;
            const y1 = -40 + i * 8;
            const cpx1 = 1100 - offset * 0.6;
            const cpy1 = 200 + i * 10;
            const cpx2 = 600 + offset * 0.3;
            const cpy2 = 500 + i * 6;
            const x2 = 200 + offset * 0.5;
            const y2 = 700 + i * 5;
            return (
              <path
                key={`c${i}`}
                d={`M${x1},${y1} C${cpx1},${cpy1} ${cpx2},${cpy2} ${x2},${y2}`}
              />
            );
          })}
        </g>

        {/* Bundle 4: Center horizontal wave */}
        <g stroke="rgba(58,186,166,0.06)" strokeWidth="0.5">
          {Array.from({ length: 16 }, (_, i) => {
            const y = 300 + i * 18;
            return (
              <path
                key={`d${i}`}
                d={`M-20,${y} C${360},${y - 80 + i * 4} ${720},${y + 100 - i * 5} ${1080},${y - 60 + i * 3} S${1440},${y + 40 - i * 2} ${1460},${y}`}
              />
            );
          })}
        </g>

        {/* Bundle 5: Tight upper-right accent */}
        <g stroke="rgba(200,100,90,0.04)" strokeWidth="0.4">
          {Array.from({ length: 10 }, (_, i) => {
            const offset = i * 12;
            return (
              <path
                key={`e${i}`}
                d={`M${900 + offset},${-20 + i * 6} C${1050 + offset * 0.5},${150 + i * 8} ${1200 - offset * 0.3},${350 + i * 4} ${1460},${450 + offset}`}
              />
            );
          })}
        </g>

        {/* Concentric circle arcs (top-right, like Onye hero) */}
        <g stroke="rgba(58,186,166,0.06)" strokeWidth="0.5" fill="none">
          {Array.from({ length: 8 }, (_, i) => {
            const r = 160 + i * 40;
            return (
              <circle key={`circ${i}`} cx="1350" cy="100" r={r} />
            );
          })}
        </g>

        {/* Concentric circle arcs (bottom-left) */}
        <g stroke="rgba(140,130,210,0.05)" strokeWidth="0.4" fill="none">
          {Array.from({ length: 6 }, (_, i) => {
            const r = 120 + i * 35;
            return (
              <circle key={`circ2${i}`} cx="100" cy="800" r={r} />
            );
          })}
        </g>
      </svg>

      {/* ── Decorative organic leaf shapes (bottom-right, like Onye) ── */}
      <svg
        className="absolute bottom-0 right-0 w-[400px] h-[400px] opacity-[0.12]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="320" cy="320" rx="140" ry="80" transform="rotate(-30 320 320)" fill="#2a9d8f" />
        <ellipse cx="280" cy="350" rx="100" ry="55" transform="rotate(-50 280 350)" fill="#3dbaa6" />
        <ellipse cx="350" cy="280" rx="90" ry="45" transform="rotate(-15 350 280)" fill="#5ed4c2" />
      </svg>
    </div>
  );
}
