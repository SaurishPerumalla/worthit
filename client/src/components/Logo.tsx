import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const WorthItLogo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeMap = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-14 w-14 rounded-2xl'
  };

  const innerRadius = {
    sm: 'rounded-[7px]',
    md: 'rounded-[10px]',
    lg: 'rounded-[14px]'
  };

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div
      className={`relative flex items-center justify-center bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[2px] shadow-md shadow-emerald-500/20 group transition-all duration-200 ${sizeMap[size]} ${className}`}
    >
      <div className={`h-full w-full bg-white dark:bg-slate-950 ${innerRadius[size]} flex items-center justify-center p-1 transition-colors`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${iconSizes[size]} transition-transform duration-200 group-hover:scale-105`}
        >
          <defs>
            <linearGradient id="worthit-w-grad" x1="4" y1="24" x2="28" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {/* Dynamic 'W' whose right wing swoops into a verified Checkmark */}
          <path
            d="M5 11L9.5 22.5L14 13.5L18 22.5L27 6.5"
            stroke="url(#worthit-w-grad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Accent verification dot at check apex */}
          <circle cx="27" cy="6.5" r="1.8" fill="#06B6D4" />
        </svg>
      </div>
    </div>
  );
};
