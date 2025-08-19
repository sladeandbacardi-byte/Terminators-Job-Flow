import logoImage from "@assets/termlogobig_1755598359265.jpg";

interface TerminatorsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TerminatorsLogo({ className = "", size = 'md' }: TerminatorsLogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto', 
    lg: 'h-20 w-auto'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={logoImage} 
        alt="The Terminators Healthcare Services" 
        className={`${sizeClasses[size]} object-contain`}
        data-testid="terminators-logo"
      />
    </div>
  );
}