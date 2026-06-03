import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon";
}

export const Logo: React.FC<LogoProps> = ({ size = "md", variant = "full" }) => {
  const sizes = {
    sm: { icon: 32, text: "text-base" },
    md: { icon: 44, text: "text-xl" },
    lg: { icon: 64, text: "text-3xl" },
    xl: { icon: 96, text: "text-5xl" },
  };
  const s = sizes[size];

  const customLogoUrl  = process.env.NEXT_PUBLIC_LOGO_URL   || "";
  const customName     = process.env.NEXT_PUBLIC_CLINIC_NAME || "";

  // Logo customizado: exibe imagem fornecida via env var
  if (customLogoUrl) {
    if (variant === "icon") {
      return (
        <Image
          src={customLogoUrl}
          alt={customName || "Logo"}
          width={s.icon}
          height={s.icon}
          className="object-contain"
        />
      );
    }
    return (
      <div className="flex items-center gap-3">
        <Image
          src={customLogoUrl}
          alt={customName || "Logo"}
          width={s.icon}
          height={s.icon}
          className="object-contain"
        />
        {customName && (
          <div className={`${s.text} font-bold leading-tight tracking-tight`}>
            <span className="text-primary-600">{customName}</span>
          </div>
        )}
      </div>
    );
  }

  // Logo padrão MaisSaúdeBR (SVG inline)
  const HeartIcon = () => (
    <svg width={s.icon} height={s.icon} viewBox="0 0 100 100" fill="none">
      <g stroke="var(--color-primary-600)" strokeWidth="3.5" strokeLinecap="round">
        <line x1="22" y1="18" x2="32" y2="18" />
        <line x1="27" y1="13" x2="27" y2="23" />
      </g>
      <path
        d="M 38 32 C 28 32, 22 40, 22 50 C 22 62, 35 72, 50 84 C 65 72, 78 62, 78 50 C 78 40, 72 32, 62 32 C 56 32, 52 36, 50 40 C 48 36, 44 32, 38 32 Z"
        stroke="var(--color-primary-600)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );

  const displayName = customName || "+SaúdeBR";
  const [namePart1, namePart2] = customName
    ? [customName, ""]
    : ["+Saúde", "BR"];

  if (variant === "icon") return <HeartIcon />;

  return (
    <div className="flex items-center gap-3">
      <HeartIcon />
      <div className={`${s.text} font-bold leading-tight tracking-tight`}>
        <span className="text-primary-600">{namePart1}</span>
        {namePart2 && <span className="text-primary-800">{namePart2}</span>}
      </div>
    </div>
  );
};
