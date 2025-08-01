import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import type { Id } from 'convex/_generated/dataModel';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

interface ProductImageProps {
  imageStorageId?: Id<'_storage'>;
  externalImageUrl?: string;
  productName: string;
  className?: string;
}

export function ProductImage({
  imageStorageId,
  externalImageUrl,
  productName,
  className = 'w-full h-48 object-cover rounded-lg',
}: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  const [useExternal, setUseExternal] = useState(false);

  // Get the Convex storage URL if we have a storage ID
  const queryOptions = convexQuery(api.products.getImageUrl, {
    // biome-ignore lint/suspicious/noExplicitAny: Convex ID type casting required for optional parameter
    storageId: imageStorageId || ('' as any),
  });

  const { data: convexImageUrl, error: convexError } = useQuery({
    ...queryOptions,
    enabled: !!imageStorageId && !useExternal,
    retry: false,
  });

  // Determine which image to use
  let imageUrl = '';
  let shouldShowImage = false;

  if (
    imageStorageId &&
    convexImageUrl &&
    !convexError &&
    !imageError &&
    !useExternal
  ) {
    // Use Convex stored image (preferred)
    imageUrl = convexImageUrl;
    shouldShowImage = true;
  } else if (
    externalImageUrl &&
    (useExternal || !imageStorageId || convexError || imageError)
  ) {
    // Fallback to external image
    imageUrl = externalImageUrl;
    shouldShowImage = true;
  }

  const handleImageError = () => {
    if (imageStorageId && convexImageUrl && !useExternal) {
      // If Convex image failed, try external
      setUseExternal(true);
      setImageError(false);
    } else {
      // If external image also failed, show placeholder
      setImageError(true);
    }
  };

  if (!shouldShowImage || imageError) {
    // Show placeholder
    return (
      <div
        className={`${className} flex items-center justify-center bg-base-300 text-base-content/50`}
      >
        <div className="text-center">
          <span className="text-4xl">🖼️</span>
          <p className="mt-2 text-xs">{productName}</p>
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/nursery/noNoninteractiveElementInteractions: Image error handling required for fallback functionality
    // biome-ignore lint/performance/noImgElement: Standard img element appropriate for this use case without Next.js optimization requirements
    <img
      alt={productName}
      className={className}
      loading="lazy"
      onError={handleImageError}
      src={imageUrl}
    />
  );
}
