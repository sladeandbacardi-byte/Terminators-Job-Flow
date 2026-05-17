import logoImage from "@assets/termlogobig_1775739810095.jpg";

interface TerminatorsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TerminatorsLogo({ className = "", size = 'md' }: TerminatorsLogoProps) {
  const sizeClasses = {
    sm: 'h-[46px] w-auto max-w-[210px]',
    md: 'h-14 w-auto max-w-[220px]',
    lg: 'h-24 w-auto max-w-[320px]'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={logoImage} 
        alt="Terminators Job Flow" 
        className={`${sizeClasses[size]} object-contain`}
        data-testid="terminators-logo"
      />
    </div>
  );
}