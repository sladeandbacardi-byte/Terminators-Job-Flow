import logoImage from "@assets/termlogobig_1775739810095.jpg";
import jobFlowLogoImage from "@assets/job-flow-header-logo_1779307679615.png";

export const TERMINATORS_LOGO_IMAGE = logoImage;
export const JOBFLOW_LOGO_IMAGE = jobFlowLogoImage;

interface JobFlowBrandLockupProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  stacked?: boolean;
  "data-testid"?: string;
}

const lockupSizeClasses = {
  xs: {
    terminators: "w-[70px]",
    jobFlow: "w-[52px]",
    gap: "gap-1.5",
  },
  sm: {
    terminators: "w-[110px]",
    jobFlow: "w-[82px]",
    gap: "gap-2.5",
  },
  md: {
    terminators: "w-[180px]",
    jobFlow: "w-[135px]",
    gap: "gap-3",
  },
  lg: {
    terminators: "w-[220px]",
    jobFlow: "w-[160px]",
    gap: "gap-4",
  },
} as const;

export function JobFlowBrandLockup({
  className = "",
  size = "md",
  stacked = false,
  "data-testid": dataTestId,
}: JobFlowBrandLockupProps) {
  const sizing = lockupSizeClasses[size];
  return (
    <div
      className={`flex ${stacked ? "flex-col" : "items-center"} ${sizing.gap} ${className}`}
      data-testid={dataTestId || "jobflow-brand-lockup"}
    >
      <img
        src={logoImage}
        alt="The Terminators"
        className={`${stacked ? "w-[32px]" : sizing.terminators} h-auto shrink-0 object-contain`}
      />
      <img
        src={jobFlowLogoImage}
        alt="JobFlow Field Service Management"
        className={`${stacked ? "w-[32px]" : sizing.jobFlow} h-auto shrink-0 object-contain`}
      />
    </div>
  );
}