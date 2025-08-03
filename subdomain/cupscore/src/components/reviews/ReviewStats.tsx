import { RatingStars } from './RatingStars';

interface ReviewStatsProps {
  stats: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      3.5: number;
      4: number;
      4.5: number;
      5: number;
    };
  };
}

const RATING_LABELS = {
  5: '최고',
  4.5: '강력 추천',
  4: '추천',
  3.5: '좋음',
  3: '보통',
  2: '별로',
  1: '최악'
} as const;

export function ReviewStats({ stats }: ReviewStatsProps) {
  if (stats.totalReviews === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body text-center py-8">
          <p className="text-base-content/60">아직 리뷰가 없습니다.</p>
          <p className="text-sm text-base-content/50">첫 번째 리뷰를 작성해보세요!</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(stats.ratingDistribution));

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-lg mb-4">리뷰 요약</h3>
        
        {/* Overall Rating */}
        <div className="flex items-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {stats.averageRating.toFixed(1)}
            </div>
            <RatingStars rating={stats.averageRating} readonly size="md" />
            <div className="text-sm text-base-content/60 mt-1">
              {stats.totalReviews}개 리뷰
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm mb-3">평점 분포</h4>
          {Object.entries(RATING_LABELS).map(([rating, label]) => {
            const ratingNum = Number(rating) as keyof typeof stats.ratingDistribution;
            const count = stats.ratingDistribution[ratingNum];
            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={rating} className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 w-16">
                  <span className="text-xs">{rating}</span>
                  <svg 
                    className="w-3 h-3 text-yellow-400" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-xs text-base-content/60 w-8">
                    {count}
                  </span>
                  <span className="text-xs text-base-content/40 w-10">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                
                <div className="text-xs text-base-content/60 w-12">
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}