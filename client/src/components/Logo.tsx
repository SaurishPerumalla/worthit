import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DealChaserLogo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
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
            <linearGradient id="pricesentry-grad" x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {/* Sentry Shield */}
          <path
            d="M16 4.5L7 8.5V15.5C7 21.8 10.8 27.5 16 29C21.2 27.5 25 21.8 25 15.5V8.5L16 4.5Z"
            stroke="url(#pricesentry-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Centered Deal Verification Check */}
          <path
            d="M11.5 16.5L14.5 19.5L20.5 13"
            stroke="url(#pricesentry-grad)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
