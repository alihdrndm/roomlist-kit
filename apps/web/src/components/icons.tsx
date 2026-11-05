import type { ReactNode } from "react";

// Hand-drawn 20×20 line icons (1.5px stroke). Decorative: every icon sits next to a
// word, so each one is aria-hidden. No icon package (OP7).

type IconProps = { className?: string | undefined };

function Svg({
  children,
  className = "size-4",
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const UploadIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M10 13V3.5M6 7l4-4 4 4" />
    <path d="M3.5 12.5v2A2 2 0 0 0 5.5 16.5h9a2 2 0 0 0 2-2v-2" />
  </Svg>
);
export const FileIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M11.5 2.5H6A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5z" />
    <path d="M11.5 2.5v4h4M7.5 10.5h5M7.5 13.5h5" />
  </Svg>
);
export const CheckIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Svg>
);
export const CheckCircleIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M6.75 10.25l2.25 2.25 4.25-4.75" />
  </Svg>
);
export const ErrorIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
  </Svg>
);
export const WarningIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M10 3.25L17.25 16H2.75z" />
    <path d="M10 8.25v3.5M10 13.75v.25" />
  </Svg>
);
export const InfoIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9v4.5M10 6.5v.25" />
  </Svg>
);
export const DownloadIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M10 3.5V13M6 9l4 4 4-4" />
    <path d="M3.5 16.5h13" />
  </Svg>
);
export const CopyIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
    <path d="M13 4.5V4A1.5 1.5 0 0 0 11.5 2.5H5A1.5 1.5 0 0 0 3.5 4v6.5A1.5 1.5 0 0 0 5 12h.5" />
  </Svg>
);
export const SearchIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="M12.75 12.75l3.75 3.75" />
  </Svg>
);
export const SwapIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h11.5M12.5 4l3 3-3 3M16 13H4.5M7.5 10l-3 3 3 3" />
  </Svg>
);
export const ChevronIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7.5 5l5 5-5 5" />
  </Svg>
);
export const ArrowRightIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3.5 10h13M12 5.5l4.5 4.5-4.5 4.5" />
  </Svg>
);
export const LockIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="4" y="8.5" width="12" height="8.5" rx="1.75" />
    <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5" />
  </Svg>
);
export const MoonIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M15.75 12.25A6.5 6.5 0 0 1 7.75 4.25a6.5 6.5 0 1 0 8 8z" />
  </Svg>
);
export const BedIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2.75 15.5V5M2.75 12h14.5v3.5M17.25 12V9.75A1.75 1.75 0 0 0 15.5 8H9v4" />
    <circle cx="5.75" cy="9.25" r="1.5" />
  </Svg>
);
export const ColumnsIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="3.5" width="14" height="13" rx="1.5" />
    <path d="M7.75 3.5v13M12.25 3.5v13" />
  </Svg>
);
export const ListIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9" />
    <path d="M3.75 5.5h.5M3.75 10h.5M3.75 14.5h.5" />
  </Svg>
);
export const PrintIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5.5 7.5V3.5h9v4M5.5 13.5h-2v-6h13v6h-2" />
    <rect x="5.5" y="11" width="9" height="5.5" rx="0.75" />
  </Svg>
);
export const ResetIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9.5a6 6 0 1 1 1.75 4.25" />
    <path d="M4 4.75V9.5h4.75" />
  </Svg>
);
export const CloseIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Svg>
);
export const ExternalIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M11.5 3.5h5v5M16.5 3.5L9.5 10.5M14.5 12v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5h3" />
  </Svg>
);
export const GitHubIcon = ({ className = "size-4" }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={`shrink-0 ${className}`}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/** The brand mark: a key tag (a hotel key fob) with list lines, drawn in ink. */
export function BrandMark({ className = "size-7" }: IconProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect x="2" y="2" width="24" height="24" rx="7" fill="#16171b" />
      <circle cx="9" cy="9" r="2.1" fill="#f7f5f0" />
      <path
        d="M14 9h7M7.5 14.5h13.5M7.5 19.5h9"
        stroke="#f7f5f0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="19.5" r="1.6" fill="#7f95ea" />
    </svg>
  );
}
