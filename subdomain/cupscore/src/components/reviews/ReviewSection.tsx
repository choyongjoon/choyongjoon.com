import { useUser } from '@clerk/tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Id } from 'convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { ReviewStats } from './ReviewStats';

interface ReviewSectionProps {
  productId: Id<'products'>;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { user } = useUser();
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState(false);

  // Get review statistics
  const { data: reviewStats } = useQuery(
    convexQuery(api.reviews.getProductStats, { productId })
  );

  // Get product reviews
  const { data: reviews } = useQuery(
    convexQuery(api.reviews.getByProduct, { productId, limit: 20 })
  );

  // Get user's existing review
  const { data: userReview } = useQuery({
    ...convexQuery(api.reviews.getUserReview, {
      productId,
      userId: user?.id || '',
    }),
    enabled: !!user?.id,
  });

  const handleWriteReview = () => {
    if (!user) {
      alert('리뷰를 작성하려면 로그인이 필요합니다.');
      return;
    }
    setShowForm(true);
    setEditingReview(false);
  };

  const handleEditReview = () => {
    setShowForm(true);
    setEditingReview(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingReview(false);
    // The queries will automatically refetch due to invalidation
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingReview(false);
  };

  const hasUserReview = !!userReview;

  return (
    <div className="space-y-6">
      {/* Review Statistics */}
      {reviewStats && <ReviewStats stats={reviewStats} />}

      {/* Review Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">
          리뷰 ({reviewStats?.totalReviews || 0})
        </h3>
        
        {user && !showForm && (
          <div className="flex gap-2">
            {hasUserReview ? (
              <button
                onClick={handleEditReview}
                className="btn btn-outline btn-sm"
                type="button"
              >
                내 리뷰 수정
              </button>
            ) : (
              <button
                onClick={handleWriteReview}
                className="btn btn-primary btn-sm"
                type="button"
              >
                리뷰 작성
              </button>
            )}
          </div>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <ReviewForm
          productId={productId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* Reviews List */}
      {reviews && reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review._id}
              review={review}
              currentUserId={user?.id}
              onEdit={review.userId === user?.id ? handleEditReview : undefined}
              onDelete={review.userId === user?.id ? () => {
                // TODO: Implement delete functionality
                console.log('Delete review:', review._id);
              } : undefined}
            />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body text-center py-12">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
                <svg
                  className="h-8 w-8 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-lg mb-2">아직 리뷰가 없습니다</h4>
              <p className="text-base-content/60 mb-4">
                이 상품에 대한 첫 번째 리뷰를 작성해보세요!
              </p>
              {user && (
                <button
                  onClick={handleWriteReview}
                  className="btn btn-primary"
                  type="button"
                >
                  첫 리뷰 작성하기
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}