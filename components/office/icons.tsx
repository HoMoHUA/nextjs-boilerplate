type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ChevronLeft = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}><path d="M9 6l6 6-6 6" /></svg>
);
export const ArrowLeft = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const Dots = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="currentColor">
    <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
  </svg>
);
export const Paperclip = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
    <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" />
  </svg>
);
export const Send = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}><path d="M4 12L20 4l-5 16-3-7-8-1z" /></svg>
);
export const Calendar = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}>
    <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);
export const Office = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="22" height="22" className={className} {...base}>
    <path d="M4 11l8-5 8 5v8a1 1 0 01-1 1H5a1 1 0 01-1-1z" /><path d="M9 20v-5h6v5" />
  </svg>
);
export const Palette = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="22" height="22" className={className} {...base}>
    <path d="M12 3a9 9 0 100 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.8-1.3-.8-2.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 004-4C21 6.6 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.3" r="1" /><circle cx="14.5" cy="7.3" r="1" />
  </svg>
);
export const Sliders = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="22" height="22" className={className} {...base}>
    <path d="M6 4v16M12 4v16M18 4v16" /><path d="M4 9h4M10 15h4M16 8h4" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="12" height="12" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
);
export const Plus = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const X = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Stop = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
);

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden>
      <ellipse cx="32" cy="52" rx="24" ry="6" fill="#7fbf6a" />
      <path d="M8 50 L26 18 L44 50 Z" fill="#f08a3c" />
      <path d="M26 18 L44 50 L34 50 Z" fill="#d76a25" />
      <path d="M22 50 L26 38 L30 50 Z" fill="#7a3d18" />
      <path d="M44 8 L36 26 H40 L33 38 H39 L32 50 H56 L49 38 H55 L48 26 H52 Z" fill="#2f7d4a" />
      <rect x="43" y="48" width="2.5" height="5" fill="#6b4226" />
    </svg>
  );
}
