import type { Id } from 'convex/_generated/dataModel';
import { RatingStars } from './RatingStars';

interface ReviewCardProps {
  review: {
    _id: Id<'reviews'>;
    userId: string;
    userName?: string;
    userImageUrl?: string;
    rating: number;
    text?: string;
    imageUrls?: string[];
    ratingLabel: string;
    createdAt: number;
    updatedAt: number;
  };
  currentUserId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ review, currentUserId, onEdit, onDelete }: ReviewCardProps) {
  const isOwner = currentUserId === review.userId;
  const createdDate = new Date(review.createdAt);
  const updatedDate = new Date(review.updatedAt);
  const wasEdited = review.updatedAt > review.createdAt;

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4">
        {/* User Info and Rating */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* User Avatar */}
            <div className="avatar">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {review.userImageUrl ? (
                  <img 
                    src={review.userImageUrl} 
                    alt={review.userName || '사용자'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-medium text-sm">
                    {(review.userName || '익명')[0]}
                  </span>
                )}
              </div>
            </div>

            {/* User Name and Rating */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {review.userName || '익명 사용자'}
                </span>
                {wasEdited && (
                  <span className="text-xs text-base-content/50">(수정됨)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <RatingStars rating={review.rating} readonly size="sm" />
                <span className="text-sm font-medium text-primary">
                  {review.ratingLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Action Menu */}
          {isOwner && (
            <div className="dropdown dropdown-end">
              <button 
                className="btn btn-ghost btn-circle btn-xs"
                type="button"
                tabIndex={0}
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M12 5v.01M12 12v.01M12 19v.01" 
                  />
                </svg>
              </button>
              <ul 
                className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32"
                tabIndex={0}
              >
                {onEdit && (
                  <li>
                    <button onClick={onEdit} type="button">
                      수정
                    </button>
                  </li>
                )}
                {onDelete && (
                  <li>
                    <button onClick={onDelete} className="text-error" type="button">
                      삭제
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Review Text */}
        {review.text && (
          <div className="mt-3">
            <p className="text-sm text-base-content/80 whitespace-pre-wrap">
              {review.text}
            </p>
          </div>
        )}

        {/* Review Images */}
        {review.imageUrls && review.imageUrls.length > 0 && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {review.imageUrls.map((imageUrl, index) => (
                <div key={index} className="aspect-square rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={`리뷰 사진 ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      // Open modal for full-size image view
                      const modal = document.getElementById(`image-modal-${index}`) as HTMLDialogElement;
                      modal?.showModal();
                    }}
                  />
                  
                  {/* Full-size image modal */}
                  <dialog id={`image-modal-${index}`} className="modal">
                    <div className="modal-box p-0 max-w-none w-auto">
                      <img
                        src={imageUrl}
                        alt={`리뷰 사진 ${index + 1}`}
                        className="w-full h-auto"
                      />
                    </div>
                    <form method="dialog" className="modal-backdrop">
                      <button type="submit">close</button>
                    </form>
                  </dialog>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        <div className="mt-3 text-xs text-base-content/50">
          {wasEdited ? (
            <>
              {updatedDate.toLocaleDateString('ko-KR')} 수정
            </>
          ) : (
            <>
              {createdDate.toLocaleDateString('ko-KR')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}