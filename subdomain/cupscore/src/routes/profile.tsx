import { useUser } from '@clerk/tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { MyReview } from '~/components/reviews/MyReview';
import { UserRatingHistogram } from '~/components/reviews/UserRatingHistogram';
import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isLoaded } = useUser();

  // Get user's reviews
  const {
    data: userReviews = [],
    isLoading: reviewsLoading,
    error: reviewsError,
  } = useQuery({
    ...convexQuery(api.reviews.getUserReviews, {
      userId: user?.id || '',
    }),
    enabled: !!user?.id,
  });

  // Get user's rating statistics
  const { data: userStats, isLoading: statsLoading } = useQuery({
    ...convexQuery(api.reviews.getUserStats, {
      userId: user?.id || '',
    }),
    enabled: !!user?.id,
  });

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 font-bold text-2xl">로그인이 필요합니다</h1>
          <p className="mb-6 text-base-content/70">
            프로필을 보려면 로그인해주세요.
          </p>
          <Link className="btn btn-primary" to="/">
            홈으로 가기
          </Link>
        </div>
      </div>
    );
  }

  const isLoading = reviewsLoading || statsLoading;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      {/* Profile Header */}
      <div className="card mb-6 bg-base-100 shadow-md">
        <div className="card-body">
          <div className="flex items-center gap-4">
            {user.imageUrl && (
              <div className="avatar">
                <div className="h-16 w-16 rounded-full">
                  <img
                    alt={user.fullName || '프로필'}
                    className="h-full w-full object-cover"
                    src={user.imageUrl}
                  />
                </div>
              </div>
            )}
            <div className="flex-1">
              <h1 className="font-bold text-2xl">
                {user.fullName || user.firstName || '사용자'}
              </h1>
              {user.primaryEmailAddress && (
                <p className="text-base-content/70">
                  {user.primaryEmailAddress.emailAddress}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Rating Statistics */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              {(() => {
                if (isLoading) {
                  return (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md" />
                    </div>
                  );
                }

                if (userStats) {
                  return (
                    <>
                      <div className="mb-6 text-center">
                        <div className="stat">
                          <div className="stat-title">평균 평점</div>
                          <div className="stat-value text-primary">
                            {userStats.averageRating.toFixed(1)}
                          </div>
                          <div className="stat-desc">
                            총 {userStats.totalReviews}개의 평가
                          </div>
                        </div>
                      </div>

                      <UserRatingHistogram
                        ratingDistribution={userStats.ratingDistribution}
                        totalReviews={userStats.totalReviews}
                      />
                    </>
                  );
                }

                return (
                  <div className="py-8 text-center">
                    <p className="text-base-content/60">
                      통계를 불러올 수 없습니다.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Review History */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title mb-4">내 평가</h2>

              {(() => {
                if (isLoading) {
                  return (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md" />
                    </div>
                  );
                }

                if (reviewsError) {
                  return (
                    <div className="py-8 text-center">
                      <p className="mb-4 text-error">
                        평가를 불러오는 중 오류가 발생했습니다.
                      </p>
                      <p className="text-base-content/60 text-sm">
                        {String(reviewsError)}
                      </p>
                    </div>
                  );
                }

                if (userReviews?.length > 0) {
                  return (
                    <div className="space-y-4">
                      {userReviews.map((review) => (
                        <MyReview key={review._id} review={review} />
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="py-8 text-center">
                    <p className="mb-4 text-base-content/60">
                      아직 작성한 평가가 없습니다.
                    </p>
                    <Link
                      className="btn btn-primary"
                      search={{ searchTerm: '', cafeId: '', category: '' }}
                      to="/search"
                    >
                      상품 찾아보기
                    </Link>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
