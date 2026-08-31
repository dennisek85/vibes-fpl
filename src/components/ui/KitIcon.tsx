import React, { useState } from 'react';
import { TEAM_STYLES } from '@/lib/fpl-constants';

interface KitIconProps {
  teamCode?: number;
  teamShortName?: string;
  isGoalkeeper?: boolean;
  className?: string;
}

export const KitIcon: React.FC<KitIconProps> = ({ 
  teamCode, 
  teamShortName = 'ARS', 
  isGoalkeeper = false, 
  className = 'w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 lg:w-28 lg:h-28' 
}) => {
  const [imgError, setImgError] = useState(false);

  const cdnUrl = teamCode
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${isGoalkeeper ? '_1' : ''}-66.png`
    : null;

  const style = TEAM_STYLES[teamShortName?.toUpperCase() || 'ARS'] || { primary: '#3b82f6', secondary: '#ffffff', text: '#ffffff' };
  const primary = isGoalkeeper ? '#10b981' : style.primary;
  const secondary = isGoalkeeper ? '#064e3b' : style.secondary;

  if (cdnUrl && !imgError) {
    return (
      <img
        src={cdnUrl}
        alt={`${teamShortName} kit`}
        referrerPolicy="no-referrer"
        className={`${className} object-contain drop-shadow-md select-none`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} drop-shadow-md select-none`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 28 20 L 40 10 L 60 10 L 72 20 L 88 38 L 74 52 L 68 44 L 68 88 L 32 88 L 32 44 L 26 52 L 12 38 Z"
        fill={primary}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="2.5"
      />
      <path d="M 12 38 L 26 52 L 30 46 L 20 34 Z" fill={secondary} opacity="0.9" />
      <path d="M 88 38 L 74 52 L 70 46 L 80 34 Z" fill={secondary} opacity="0.9" />
      <path d="M 40 10 Q 50 22 60 10 Q 50 16 40 10 Z" fill={secondary} />
      <rect x="47" y="24" width="6" height="60" fill={secondary} opacity="0.35" rx="2" />
    </svg>
  );
};