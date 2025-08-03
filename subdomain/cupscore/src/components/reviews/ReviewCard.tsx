import type { Id } from 'convex/_generated/dataModel';

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

export function ReviewCard({
  review,
  currentUserId,
  onEdit,
  onDelete,
}: ReviewCardProps) {
  const isOwner = currentUserId === review.userId;
  const createdDate = new Date(review.createdAt);
  const updatedDate = new Date(review.updatedAt);
  const wasEdited = review.updatedAt > review.createdAt;

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body p-4">
        {/* User Info and Rating */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* User Avatar */}
            <div className="avatar">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                {review.userImageUrl ? (
                  <img
                    alt={review.userName || '사용자'}
                    className="h-full w-full rounded-full object-cover"
                    src={review.userImageUrl}
                  />
                ) : (
                  <span className="font-medium text-primary text-sm">
                    {(review.userName || '익명')[0]}
                  </span>
                )}
              </div>
            </div>

            {/* User Name and Rating */}
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-sm">
                  {review.userName || '익명 사용자'}
                </span>
                {wasEdited && (
                  <span className="text-base-content/50 text-xs">(수정됨)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary text-sm">
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
                tabIndex={0}
                type="button"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 5v.01M12 12v.01M12 19v.01"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
              <ul
                className="dropdown-content menu z-[1] w-32 rounded-box bg-base-100 p-2 shadow"
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
                    <button
                      className="text-error"
                      onClick={onDelete}
                      type="button"
                    >
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
            <p className="whitespace-pre-wrap text-base-content/80 text-sm">
              {review.text}
            </p>
          </div>
        )}

        {/* Review Images */}
        {review.imageUrls && review.imageUrls.length > 0 && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {review.imageUrls.map((imageUrl, index) => (
                <div
                  className="aspect-square overflow-hidden rounded-lg"
                  key={index}
                >
                  <img
                    alt={`리뷰 사진 ${index + 1}`}
                    className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-105"
                    onClick={() => {
                      // Open modal for full-size image view
                      const modal = document.getElementById(
                        `image-modal-${index}`
                      ) as HTMLDialogElement;
                      modal?.showModal();
                    }}
                    src={imageUrl}
                  />

                  {/* Full-size image modal */}
                  <dialog className="modal" id={`image-modal-${index}`}>
                    <div className="modal-box w-auto max-w-none p-0">
                      <img
                        alt={`리뷰 사진 ${index + 1}`}
                        className="h-auto w-full"
                        src={imageUrl}
                      />
                    </div>
                    <form className="modal-backdrop" method="dialog">
                      <button type="submit">close</button>
                    </form>
                  </dialog>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        <div className="mt-3 text-base-content/50 text-xs">
          {wasEdited ? (
            <>{updatedDate.toLocaleDateString('ko-KR')} 수정</>
          ) : (
            <>{createdDate.toLocaleDateString('ko-KR')}</>
          )}
        </div>
      </div>
    </div>
  );
}
