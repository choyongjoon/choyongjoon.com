import { useState } from 'react';

const RATING_CONFIG = [
  { value: 1, label: '최악', color: 'text-red-500' },
  { value: 2, label: '별로', color: 'text-orange-400' }, 
  { value: 3, label: '보통', color: 'text-yellow-400' },
  { value: 3.5, label: '좋음', color: 'text-yellow-300' },
  { value: 4, label: '추천', color: 'text-green-400' },
  { value: 4.5, label: '강력 추천', color: 'text-green-300' },
  { value: 5, label: '최고', color: 'text-emerald-400' }
];

interface RatingStarsProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function RatingStars({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = 'md',
  showLabel = false 
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };
  
  const currentRating = hoverRating !== null ? hoverRating : rating;
  const ratingConfig = RATING_CONFIG.find(r => r.value === currentRating);
  
  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {RATING_CONFIG.map((config) => {
          const isActive = currentRating >= config.value;
          const isHalf = currentRating === config.value - 0.5;
          
          return (
            <button
              key={config.value}
              type="button"
              className={`${sizeClasses[size]} ${
                readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
              } transition-transform`}
              onClick={() => handleClick(config.value)}
              onMouseEnter={() => handleMouseEnter(config.value)}
              onMouseLeave={handleMouseLeave}
              disabled={readonly}
            >
              {isActive ? (
                <svg
                  className={`h-full w-full ${config.color}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ) : isHalf ? (
                <svg
                  className={`h-full w-full ${config.color}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <defs>
                    <linearGradient id={`half-${config.value}`}>
                      <stop offset="50%" stopColor="currentColor" />
                      <stop offset="50%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  <path 
                    fill={`url(#half-${config.value})`}
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" 
                  />
                </svg>
              ) : (
                <svg
                  className={`h-full w-full text-base-300`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      
      {showLabel && ratingConfig && (
        <span className={`text-sm font-medium ${ratingConfig.color}`}>
          {ratingConfig.label}
        </span>
      )}
      
      {!readonly && currentRating > 0 && (
        <span className="text-xs text-base-content/60">
          ({currentRating})
        </span>
      )}
    </div>
  );
}