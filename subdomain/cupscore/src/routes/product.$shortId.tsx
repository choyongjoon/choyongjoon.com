import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { Id } from 'convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { ConvexImage } from '../components/ConvexImage';
import { RatingStars } from '../components/reviews/RatingStars';
import { ReviewSection } from '../components/reviews/ReviewSection';

export const Route = createFileRoute('/product/$shortId')({
  component: ProductPage,
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.products.getProductWithImageByShortId, {
        shortId: opts.params.shortId,
      })
    );
  },
});

function ProductPage() {
  const { shortId } = Route.useParams();

  const { data: product } = useSuspenseQuery(
    convexQuery(api.products.getProductWithImageByShortId, {
      shortId,
    })
  );

  const { data: cafe } = useSuspenseQuery(
    convexQuery(api.cafes.getById, { cafeId: product?.cafeId as Id<'cafes'> })
  );

  const { data: reviewStats } = useSuspenseQuery(
    convexQuery(api.reviews.getProductStats, { productId: product?._id as Id<'products'> })
  );

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="text-center">
          <h1 className="mb-4 font-bold text-2xl">상품을 찾을 수 없습니다</h1>
          <Link className="btn btn-primary" to="/">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Breadcrumb */}
      <div className="bg-base-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="breadcrumbs text-sm">
            <ul>
              <li>
                <Link to="/">홈</Link>
              </li>
              {cafe && (
                <li>
                  <Link params={{ slug: cafe.slug }} to="/cafe/$slug">
                    {cafe.name}
                  </Link>
                </li>
              )}
              <li>{product.name}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Product Image */}
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <ConvexImage
                alt={product.name}
                className="aspect-square w-full rounded-lg object-cover shadow-lg"
                fallbackImageUrl={product.externalImageUrl}
                getImageUrl={api.products.getImageUrl}
                imageStorageId={product.imageStorageId}
              />
            </div>
          </div>

          {/* Product Information */}
          <div className="space-y-6">
            <div>
              <h1 className="mb-2 font-bold text-3xl">{product.name}</h1>
              {product.nameEn && (
                <p className="mb-4 text-base-content/70 text-lg">
                  {product.nameEn}
                </p>
              )}

              {/* Cafe Link */}
              {cafe && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-base-content/60 text-sm">
                    판매 카페:
                  </span>
                  <Link
                    className="link link-primary font-medium"
                    params={{ slug: cafe.slug }}
                    to="/cafe/$slug"
                  >
                    {cafe.name}
                  </Link>
                </div>
              )}

              {/* Category Badge */}
              {product.category && (
                <div className="mb-4">
                  <div className="badge badge-secondary badge-lg">
                    {product.category}
                  </div>
                </div>
              )}

              {/* Rating Display */}
              {reviewStats && reviewStats.totalReviews > 0 && (
                <div className="mb-4 flex items-center gap-3">
                  <RatingStars rating={reviewStats.averageRating} readonly size="md" />
                  <span className="font-medium text-primary">
                    {reviewStats.averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-base-content/60">
                    ({reviewStats.totalReviews}개 리뷰)
                  </span>
                </div>
              )}
            </div>

            {/* Price */}
            {product.price && (
              <div className="card border border-primary/20 bg-primary/10">
                <div className="card-body">
                  <h3 className="card-title text-primary">가격</h3>
                  <p className="font-bold text-2xl text-primary">
                    {product.price.toLocaleString()}원
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h3 className="card-title">상품 설명</h3>
                  <p className="whitespace-pre-wrap text-base-content/80">
                    {product.description}
                  </p>
                </div>
              </div>
            )}

            {/* Product Metadata */}
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h3 className="card-title">상품 정보</h3>
                <div className="space-y-3">
                  {product.externalCategory && (
                    <div className="flex justify-between">
                      <span className="text-base-content/60">
                        원본 카테고리:
                      </span>
                      <span>{product.externalCategory}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-base-content/60">상품 상태:</span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`badge ${
                          product.isActive ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {product.isActive ? '판매중' : '단종'}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-base-content/60">등록일:</span>
                    <span>
                      {new Date(product.addedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-base-content/60">최종 업데이트:</span>
                    <span>
                      {new Date(product.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  {product.removedAt && (
                    <div className="flex justify-between">
                      <span className="text-base-content/60">단종일:</span>
                      <span>
                        {new Date(product.removedAt).toLocaleDateString(
                          'ko-KR'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* External Link */}
            {product.externalUrl && (
              <div className="flex gap-4">
                <a
                  className="btn btn-primary btn-block"
                  href={product.externalUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  공식 사이트에서 보기
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>External Link</title>
                    <path
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <div className="divider">
            <h2 className="font-bold text-2xl">리뷰</h2>
          </div>
          <ReviewSection productId={product._id} />
        </div>

        {/* Related Products */}
        {cafe && (
          <div className="mt-16">
            <div className="divider">
              <h2 className="font-bold text-2xl">같은 카페의 다른 상품</h2>
            </div>
            <RelatedProducts
              cafeId={product.cafeId}
              currentProductId={product._id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedProducts({
  cafeId,
  currentProductId,
}: {
  cafeId: Id<'cafes'>;
  currentProductId: Id<'products'>;
}) {
  const { data: products } = useSuspenseQuery(
    convexQuery(api.products.getByCafe, { cafeId })
  );

  const relatedProducts = products
    ?.filter((p) => p._id !== currentProductId && p.isActive)
    ?.slice(0, 8);

  if (!relatedProducts || relatedProducts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-base-content/60">관련 상품이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {relatedProducts.map((product) => (
        <Link
          className="card bg-base-100 shadow-md transition-shadow hover:shadow-lg"
          key={product._id}
          params={{ shortId: product.shortId || product._id }}
          to="/product/$shortId"
        >
          <figure className="aspect-square">
            <ConvexImage
              alt={product.name}
              className="h-full w-full object-cover"
              fallbackImageUrl={product.externalImageUrl}
              getImageUrl={api.products.getImageUrl}
              imageStorageId={product.imageStorageId}
            />
          </figure>
          <div className="card-body p-4">
            <h3 className="card-title text-sm leading-tight">{product.name}</h3>
            {product.category && (
              <p className="text-xs text-base-content/60">{product.category}</p>
            )}
            {product.averageRating && product.totalReviews && product.totalReviews > 0 && (
              <div className="flex items-center gap-1">
                <RatingStars rating={product.averageRating} readonly size="sm" />
                <span className="text-xs text-base-content/60">
                  ({product.totalReviews})
                </span>
              </div>
            )}
            {product.price && (
              <p className="text-sm font-semibold text-primary">
                {product.price.toLocaleString()}원
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
