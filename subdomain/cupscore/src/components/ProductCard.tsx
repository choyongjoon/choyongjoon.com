import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import { ConvexImage } from '../components/ConvexImage';
import { RatingSummary } from '../components/RatingSummary';

export function ProductCard({ product }: { product: Doc<'products'> }) {
  const { data: reviewStats } = useSuspenseQuery(
    convexQuery(api.reviews.getProductStats, { productId: product._id })
  );

  return (
    <Link
      className="card bg-base-100 shadow-md transition-shadow hover:shadow-lg"
      key={product._id}
      params={{ shortId: product.shortId }}
      to="/product/$shortId"
    >
      <figure className="">
        <ConvexImage
          alt={product.name}
          className="aspect-square w-full object-cover"
          fallbackImageUrl={product.externalImageUrl}
          getImageUrl={api.products.getImageUrl}
          imageStorageId={product.imageStorageId}
        />
      </figure>
      <div className="card-body overflow-hidden p-2 md:p-4">
        <h3 className="card-title break-keep">{product.name}</h3>
        <RatingSummary reviewStats={reviewStats} />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {product.price && (
              <p className="font-bold text-lg text-primary">
                {product.price.toLocaleString()}원
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
