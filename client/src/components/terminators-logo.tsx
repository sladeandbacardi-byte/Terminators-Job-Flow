interface TerminatorsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TerminatorsLogo({ className = "", size = 'md' }: TerminatorsLogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto', 
    lg: 'h-16 w-auto'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Company Logo SVG */}
      <div className={`${sizeClasses[size]} flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-2`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white" fill="currentColor">
          {/* Shield background */}
          <path d="M50 10 L85 25 L85 55 C85 75 50 90 50 90 C50 90 15 75 15 55 L15 25 Z" 
                fill="currentColor" opacity="0.9"/>
          
          {/* Pest control icon - bug with X */}
          <g transform="translate(50,45)">
            {/* Bug body */}
            <ellipse cx="0" cy="0" rx="12" ry="8" fill="white" opacity="0.9"/>
            <ellipse cx="0" cy="-3" rx="8" ry="5" fill="white" opacity="0.9"/>
            
            {/* Bug antennae */}
            <line x1="-6" y1="-8" x2="-10" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="6" y1="-8" x2="10" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            
            {/* X mark over bug */}
            <line x1="-8" y1="-8" x2="8" y2="8" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
            <line x1="8" y1="-8" x2="-8" y2="8" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
          </g>
          
          {/* Company initials */}
          <text x="50" y="75" textAnchor="middle" className="text-xs font-bold fill-white">T</text>
        </svg>
      </div>
      
      {/* Company name */}
      <div className="flex flex-col">
        <span className={`font-bold text-gray-900 dark:text-white ${
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-xl'
        }`}>
          The Terminators
        </span>
        <span className={`text-gray-600 dark:text-gray-400 ${
          size === 'sm' ? 'text-xs' : 'text-sm'
        }`}>
          Pest Control & Hygiene Services
        </span>
      </div>
    </div>
  );
}