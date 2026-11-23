import React, { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF0EB] via-[#FFE4DC] to-[#FED7CD] text-[#A66F7B] p-4 text-center ${className}`}
      >
        <div className="w-10 h-10 rounded-2xl bg-white/90 border border-[#FED7CD] flex items-center justify-center text-[#FF7262] mb-1.5 shadow-xs">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold text-[#5C4A51] line-clamp-2 max-w-[180px]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
