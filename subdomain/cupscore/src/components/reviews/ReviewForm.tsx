import { useUser } from '@clerk/tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Id } from 'convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { RatingStars } from './RatingStars';

interface ReviewFormProps {
  productId: Id<'products'>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ productId, onSuccess, onCancel }: ReviewFormProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imageStorageIds, setImageStorageIds] = useState<Id<'_storage'>[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Check if user already has a review for this product
  const { data: existingReview } = useQuery({
    ...convexQuery(api.reviews.getUserReview, {
      productId,
      userId: user?.id || '',
    }),
    enabled: !!user?.id,
  });

  // Initialize form with existing review data
  useState(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setText(existingReview.text || '');
      setImageStorageIds(existingReview.imageStorageIds || []);
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File): Promise<Id<'_storage'>> => {
      // This is a simplified approach - in production you'd want proper error handling
      throw new Error('Image upload not yet implemented - for now, reviews without images only');
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: {
      rating: number;
      text?: string;
      imageStorageIds?: Id<'_storage'>[];
    }) => {
      // This would need to be implemented with proper Convex client integration
      // For now, we'll simulate the API call
      console.log('Submitting review:', data);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      onSuccess?.();
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 2) {
      alert('최대 2장까지 업로드할 수 있습니다.');
      return;
    }
    setImages([...images, ...files]);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImageStorageIds(imageStorageIds.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('리뷰를 작성하려면 로그인이 필요합니다.');
      return;
    }

    if (rating === 0) {
      alert('별점을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    
    try {
      // Upload new images
      const newStorageIds: Id<'_storage'>[] = [];
      for (const file of images) {
        if (file instanceof File) {
          const storageId = await uploadImageMutation.mutateAsync(file);
          newStorageIds.push(storageId);
        }
      }

      // Combine existing and new image storage IDs
      const allImageStorageIds = [...imageStorageIds, ...newStorageIds];

      // Submit review
      await submitReviewMutation.mutateAsync({
        rating,
        text: text.trim() || undefined,
        imageStorageIds: allImageStorageIds.length > 0 ? allImageStorageIds : undefined,
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('리뷰 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-md">
        <div className="card-body text-center">
          <p className="text-base-content/70">리뷰를 작성하려면 로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  const isSubmitting = uploadImageMutation.isPending || submitReviewMutation.isPending || isUploading;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h3 className="card-title">
          {existingReview ? '리뷰 수정' : '리뷰 작성'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">별점 *</span>
            </label>
            <div className="flex items-center gap-4">
              <RatingStars 
                rating={rating} 
                onRatingChange={setRating}
                size="lg"
                showLabel
              />
            </div>
          </div>

          {/* Review Text */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">리뷰 내용</span>
              <span className="label-text-alt text-base-content/60">선택사항</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-24 resize-none"
              placeholder="이 음료에 대한 솔직한 후기를 남겨주세요..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                {text.length}/500
              </span>
            </label>
          </div>

          {/* Photo Upload */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">사진</span>
              <span className="label-text-alt text-base-content/60">최대 2장</span>
            </label>
            
            {/* Image Preview */}
            {(images.length > 0 || imageStorageIds.length > 0) && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {/* Existing images from storage */}
                {imageStorageIds.map((_, index) => (
                  <div key={`existing-${index}`} className="relative">
                    <div className="aspect-square rounded-lg bg-base-200 flex items-center justify-center">
                      <span className="text-xs text-base-content/60">기존 이미지</span>
                    </div>
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error"
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {/* New image previews */}
                {images.map((file, index) => (
                  <div key={`new-${index}`} className="relative">
                    <div className="aspect-square rounded-lg overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error"
                      onClick={() => removeImage(imageStorageIds.length + index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {images.length + imageStorageIds.length < 2 && (
              <input
                type="file"
                accept="image/*"
                multiple
                className="file-input file-input-bordered"
                onChange={handleImageChange}
              />
            )}
          </div>

          {/* Submit Buttons */}
          <div className="card-actions justify-end">
            {onCancel && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting && <span className="loading loading-spinner loading-sm" />}
              {existingReview ? '수정하기' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}