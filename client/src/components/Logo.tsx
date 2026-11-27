import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DealChaserLogo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';

  return (
    <div
      className={`relative flex items-center justify-center ${sizeClass} overflow-hidden shadow-lg shadow-violet-950/50 ring-1 ring-violet-400/30 ${className}`}
    >
      <img
        src="/logo.png"
        alt="DealChaser"
        className="h-full w-full object-cover"
      />
    </div>
  );
};
