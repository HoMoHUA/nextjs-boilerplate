import type { AgentLook } from "@/lib/types";

/** Small 2D avatar matching the 3D character's look. */
export function AgentAvatar({ look, size = 32 }: { look: AgentLook; size?: number }) {
  const curly = look.hairStyle === "curly" || look.hairStyle === "fluffy";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="46" rx="13" ry="7" fill={look.shirt} />
      <ellipse cx="24" cy="45" rx="5" ry="4" fill={look.accent} />
      <circle cx="9.5" cy="24" r="3" fill={look.skin} />
      <circle cx="38.5" cy="24" r="3" fill={look.skin} />
      <circle cx="24" cy="23" r="14" fill={look.skin} />
      {curly ? (
        [...Array(11)].map((_, i) => {
          const a = Math.PI + (i / 10) * Math.PI;
          return <circle key={i} cx={24 + Math.cos(a) * 13} cy={20 + Math.sin(a) * 12} r={5.2} fill={look.hair} />;
        })
      ) : (
        <path d="M9.5 22 C9 8, 39 8, 38.5 22 C35 15, 28 13, 22 15 C17 16, 12 18, 9.5 22 Z" fill={look.hair} />
      )}
      {look.hairStyle === "bun" && <circle cx="24" cy="6" r="5.5" fill={look.hair} />}
      <circle cx="19" cy="24" r="1.9" fill="#221a17" />
      <circle cx="29" cy="24" r="1.9" fill="#221a17" />
      {look.glasses && (
        <g fill="none" stroke="#c9c9cf" strokeWidth="1.2">
          <circle cx="19" cy="24" r="4.2" />
          <circle cx="29" cy="24" r="4.2" />
          <path d="M23.2 24 h1.6" />
        </g>
      )}
      <ellipse cx="15.5" cy="28.5" rx="2.2" ry="1.3" fill="#f29a8a" opacity=".6" />
      <ellipse cx="32.5" cy="28.5" rx="2.2" ry="1.3" fill="#f29a8a" opacity=".6" />
      <path d="M22 30.5 q2 1.6 4 0" stroke="#8c3b32" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
