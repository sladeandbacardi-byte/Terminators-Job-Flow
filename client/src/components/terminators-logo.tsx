import logoImage from "@assets/termlogobig_1775739810095.jpg";

interface TerminatorsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TerminatorsLogo({ className = "", size = 'md' }: TerminatorsLogoProps) {
  const sizeClasses = {
    sm: 'h-[48px] w-auto max-w-[220px]',
    md: 'h-14 w-auto max-w-[220px]',
    lg: 'h-24 w-auto max-w-[320px]'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={logoImage}
        alt="The Terminators"
        className={`${sizeClasses[size]} object-contain`}
        data-testid="terminators-logo"
      />
    </div>
  );
}