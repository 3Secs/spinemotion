import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M6 3v4a6 6 0 0 0 12 0V3" />
      <path d="M12 13v8" />
      <path d="M8 21h8" />
      <path d="M10 17h4" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </IconBase>
  );
}

export function SwordsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="M9.5 6.5 3 13v3h3l6.5-6.5" />
      <path d="M16 16h5v5h-5z" />
      <line x1="21" y1="16" x2="16" y2="21" />
      <path d="M15 5h4v4" />
      <line x1="19" y1="5" x2="15" y2="9" />
    </IconBase>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </IconBase>
  );
}