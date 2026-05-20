import logoImage from "@assets/job-flow-header-logo_1779307679615.png";
import bannerImage from "@assets/job-flow-dashboard-banner_1779307679615.png";

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
        src={size === 'lg' ? bannerImage : logoImage}
        alt="Job Flow Field Service Management"
        className={`${sizeClasses[size]} object-contain`}
        data-testid="terminators-logo"
      />
    </div>
  );
}