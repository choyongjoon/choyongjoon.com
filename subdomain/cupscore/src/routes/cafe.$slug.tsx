import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { Id } from 'convex/_generated/dataModel';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import { ConvexImage } from '../components/ConvexImage';
import { ProductCard } from '../components/ProductCard';
import { getOrderedCategories } from '../utils/categories';

export const Route = createFileRoute('/cafe/$slug')({
  component: CafePage,
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.cafes.getBySlug, { slug: opts.params.slug })
    );
  },
});

function CafePage() {
  const { slug } = Route.useParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: cafe } = useSuspenseQuery(
    convexQuery(api.cafes.getBySlug, { slug })
  );
  const { data: products } = useSuspenseQuery(
    convexQuery(api.products.getByCafe, {
      cafeId: cafe?._id as Id<'cafes'>,
    })
  );

  const availableCategories = Array.from(
    new Set(products?.map((p) => p.category).filter(Boolean) || [])
  );
  const categories = getOrderedCategories(availableCategories as string[]);
  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products?.filter((p) => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-base-200">
      {/* Cafe Header */}
      <div className="bg-primary py-12 text-primary-content">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-content/20">
              <ConvexImage
                alt={cafe?.name}
                className="h-full w-full object-cover"
                fallbackImageUrl={cafe?.imageStorageId}
                getImageUrl={api.products.getImageUrl}
                imageStorageId={cafe?.imageStorageId}
              />
            </div>
            <div>
              <h1 className="font-bold text-4xl">{cafe?.name}</h1>
              <p className="mt-2 text-lg opacity-90">
                {products?.length || 0}개의 상품
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="mb-8">
          <h2 className="mb-4 font-semibold text-xl">카테고리</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedCategory('all')}
              type="button"
            >
              전체
            </button>
            {categories.map((category) => (
              <button
                className={`btn btn-sm ${selectedCategory === category ? 'btn-primary' : 'btn-outline'}`}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts?.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-base-content/70">상품이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
