export function MotionFigure() {
  return (
    <div className="figure-wrap" aria-label="示意人体骨架图">
      <div className="figure-orbit figure-orbit-a" />
      <div className="figure-orbit figure-orbit-b" />
      <svg className="motion-figure" viewBox="0 0 360 460" fill="none" role="img" aria-label="SpineMotion 示意骨架">
        <defs>
          <linearGradient id="bone-cyan" x1="130" y1="80" x2="230" y2="400">
            <stop stopColor="#86fff3" />
            <stop offset="0.55" stopColor="#55e6d8" />
            <stop offset="1" stopColor="#7c8dff" />
          </linearGradient>
          <radialGradient id="joint-glow">
            <stop stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#8dfff2" />
            <stop offset="1" stopColor="#55e6d8" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g stroke="url(#bone-cyan)" strokeWidth="5" strokeLinecap="round" filter="url(#soft-glow)" opacity=".95">
          <path d="M180 77v18" />
          <path d="M180 95v108" />
          <path d="M180 107 135 143 112 205 92 258" />
          <path d="M180 107 225 143 248 205 268 258" />
          <path d="M180 119 140 205 130 280 118 356 126 418" />
          <path d="M180 119 220 205 230 280 242 356 234 418" />
          <path d="M180 203 180 287" opacity=".55" />
        </g>

        <g fill="url(#joint-glow)">
          {[
            [180, 77, 13],
            [180, 95, 9],
            [180, 119, 10],
            [180, 203, 12],
            [135, 143, 9],
            [225, 143, 9],
            [112, 205, 8],
            [248, 205, 8],
            [92, 258, 9],
            [268, 258, 9],
            [140, 205, 10],
            [220, 205, 10],
            [130, 280, 10],
            [230, 280, 10],
            [118, 356, 8],
            [242, 356, 8],
            [126, 418, 10],
            [234, 418, 10],
            [180, 287, 8],
          ].map(([cx, cy, r], index) => (
            <circle key={index} cx={cx} cy={cy} r={r} opacity={index === 0 ? 1 : 0.8} />
          ))}
        </g>

        <g fill="#07121c" stroke="#9bfff5" strokeWidth="1.4">
          <circle cx="180" cy="77" r="4.3" />
          <circle cx="135" cy="143" r="3.6" />
          <circle cx="225" cy="143" r="3.6" />
          <circle cx="140" cy="205" r="3.8" />
          <circle cx="220" cy="205" r="3.8" />
          <circle cx="130" cy="280" r="3.8" />
          <circle cx="230" cy="280" r="3.8" />
          <circle cx="118" cy="356" r="3.4" />
          <circle cx="242" cy="356" r="3.4" />
          <circle cx="126" cy="418" r="3.8" />
          <circle cx="234" cy="418" r="3.8" />
        </g>

        <g stroke="#8ea9ff" strokeOpacity=".55" strokeWidth="1" strokeDasharray="3 7">
          <path d="M55 258h250" />
          <path d="M92 258v-42" />
          <path d="M268 258v42" />
          <circle cx="180" cy="258" r="168" strokeOpacity=".12" />
          <circle cx="180" cy="258" r="120" strokeOpacity=".08" />
        </g>

        <g fill="#6f88a8" fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="1.2">
          <text x="58" y="246">正面观</text>
          <text x="268" y="311">侧面轴</text>
          <text x="58" y="440">示意骨架 · 非实时画面</text>
        </g>
      </svg>

      <div className="figure-chip figure-chip-top">
        <span className="chip-dot" />
        本地 AI 姿态识别
      </div>
      <div className="figure-chip figure-chip-bottom">
        <span>33</span> 个关键点 / 单人
      </div>
    </div>
  );
}
