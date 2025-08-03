import { useUser } from '@clerk/tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import type { Id } from 'convex/_generated/dataModel';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';

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
      {/* Review Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xl">
          리뷰 ({reviewStats?.totalReviews || 0})
        </h3>

        {user && !showForm && (
          <div className="flex gap-2">
            {hasUserReview ? (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleEditReview}
                type="button"
              >
                내 리뷰 수정
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleWriteReview}
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
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
          productId={productId}
        />
      )}

      {/* Reviews List */}
      {reviews && reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              currentUserId={user?.id}
              key={review._id}
              onDelete={
                review.userId === user?.id
                  ? () => {
                      // TODO: Implement delete functionality
                      console.log('Delete review:', review._id);
                    }
                  : undefined
              }
              onEdit={review.userId === user?.id ? handleEditReview : undefined}
              review={review}
            />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body py-12 text-center">
              <h4 className="mb-2 font-semibold text-lg">
                아직 리뷰가 없습니다
              </h4>
              <p className="mb-4 text-base-content/60">
                이 상품에 대한 첫 번째 리뷰를 작성해보세요!
              </p>
              {user && (
                <button
                  className="btn btn-primary"
                  onClick={handleWriteReview}
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
