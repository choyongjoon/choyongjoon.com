import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ConvexImage } from '~/components/ConvexImage';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface SearchFilters {
  searchTerm: string;
  cafeId: string;
  category: string;
}

export const Route = createFileRoute('/search')({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>): SearchFilters => ({
    searchTerm: (search.q as string) || '',
    cafeId: (search.cafe as string) || '',
    category: (search.category as string) || '',
  }),
});

function SearchPage() {
  const navigate = useNavigate();
  const { searchTerm, cafeId, category } = Route.useSearch();

  // Local state for form inputs
  const [formState, setFormState] = useState({
    searchTerm: searchTerm || '',
    cafeId: cafeId || '',
    category: category || '',
  });

  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get cafes list
  const { data: cafes } = useSuspenseQuery(convexQuery(api.cafes.list, {}));

  // Get categories based on selected cafe
  const { data: categories } = useSuspenseQuery(
    convexQuery(api.products.getCategories, {
      cafeId: formState.cafeId ? (formState.cafeId as Id<'cafes'>) : undefined,
    })
  );

  // Get search suggestions for autocomplete
  const { data: suggestions } = useSuspenseQuery(
    convexQuery(api.products.getProductSuggestions, {
      searchTerm: formState.searchTerm,
      limit: 8,
    })
  );

  // Get search results
  const searchParams = useMemo(
    () => ({
      searchTerm: searchTerm || undefined,
      cafeId: cafeId ? (cafeId as Id<'cafes'>) : undefined,
      category: category || undefined,
      limit: 100,
    }),
    [searchTerm, cafeId, category]
  );

  const { data: searchResults } = useSuspenseQuery(
    convexQuery(api.products.search, searchParams)
  );

  // Update form state when URL search params change
  useEffect(() => {
    setFormState({
      searchTerm: searchTerm || '',
      cafeId: cafeId || '',
      category: category || '',
    });
  }, [searchTerm, cafeId, category]);

  // Handle form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const newSearchParams = new URLSearchParams();
    if (formState.searchTerm.trim()) {
      newSearchParams.set('q', formState.searchTerm.trim());
    }
    if (formState.cafeId) {
      newSearchParams.set('cafe', formState.cafeId);
    }
    if (formState.category) {
      newSearchParams.set('category', formState.category);
    }

    navigate({
      to: '/search',
      search: {
        searchTerm: newSearchParams.get('q') || '',
        cafeId: newSearchParams.get('cafe') || '',
        category: newSearchParams.get('category') || '',
      },
    });

    setShowSuggestions(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: { name: string }) => {
    setFormState((prev) => ({ ...prev, searchTerm: suggestion.name }));
    setShowSuggestions(false);

    const newSearchParams = new URLSearchParams();
    newSearchParams.set('q', suggestion.name);
    if (formState.cafeId) {
      newSearchParams.set('cafe', formState.cafeId);
    }
    if (formState.category) {
      newSearchParams.set('category', formState.category);
    }

    navigate({
      to: '/search',
      search: {
        searchTerm: suggestion.name,
        cafeId: formState.cafeId,
        category: formState.category,
      },
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFormState({
      searchTerm: '',
      cafeId: '',
      category: '',
    });
    navigate({
      to: '/search',
      search: {
        searchTerm: '',
        cafeId: '',
        category: '',
      },
    });
  };

  // Handle cafe change - reset category when cafe changes
  const handleCafeChange = (newCafeId: string) => {
    setFormState((prev) => ({
      ...prev,
      cafeId: newCafeId,
      category: '', // Reset category when cafe changes
    }));
  };

  const hasActiveFilters = searchTerm || cafeId || category;
  const selectedCafe = cafes?.find((cafe) => cafe._id === cafeId);

  return (
    <div className="min-h-screen bg-base-200">
      {/* Search Header */}
      <div className="bg-base-100 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="mb-6 font-bold text-3xl">검색</h1>

          {/* Search Form */}
          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Cafe Selection */}
              <div className="form-control">
                <label className="label" htmlFor="cafe-select">
                  <span className="label-text font-medium">카페 선택</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  id="cafe-select"
                  onChange={(e) => handleCafeChange(e.target.value)}
                  value={formState.cafeId}
                >
                  <option value="">모든 카페</option>
                  {cafes?.map((cafe) => (
                    <option key={cafe._id} value={cafe._id}>
                      {cafe.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selection */}
              <div className="form-control">
                <label className="label" htmlFor="category-select">
                  <span className="label-text font-medium">카테고리</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  id="category-select"
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  value={formState.category}
                >
                  <option value="">모든 카테고리</option>
                  {categories?.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Term Input with Autocomplete */}
              <div className="form-control relative">
                <label className="label" htmlFor="search-input">
                  <span className="label-text font-medium">검색어</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="search-input"
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      searchTerm: e.target.value,
                    }))
                  }
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="음료명을 입력하세요"
                  type="text"
                  value={formState.searchTerm}
                />

                {/* Autocomplete Suggestions */}
                {showSuggestions &&
                  formState.searchTerm.length > 0 &&
                  suggestions &&
                  suggestions.length > 0 && (
                    <div className="absolute top-full z-10 mt-1 w-full">
                      <ul className="menu max-h-60 overflow-y-auto rounded-box bg-base-100 shadow-lg">
                        {suggestions.map((suggestion) => (
                          <li key={suggestion.name}>
                            <button
                              className="flex justify-between"
                              onClick={() => handleSuggestionClick(suggestion)}
                              type="button"
                            >
                              <span>{suggestion.name}</span>
                              {suggestion.category && (
                                <span className="text-base-content/60 text-sm">
                                  {suggestion.category}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>검색</title>
                  <path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                검색
              </button>

              {hasActiveFilters && (
                <button
                  className="btn btn-ghost"
                  onClick={handleClearFilters}
                  type="button"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </form>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchTerm && (
                <div className="badge badge-primary badge-lg">
                  검색: {searchTerm}
                </div>
              )}
              {selectedCafe && (
                <div className="badge badge-secondary badge-lg">
                  카페: {selectedCafe.name}
                </div>
              )}
              {category && (
                <div className="badge badge-accent badge-lg">
                  카테고리: {category}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-semibold text-xl">
            검색 결과 ({searchResults?.length || 0}개)
          </h2>
        </div>

        {searchResults && searchResults.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {searchResults.map((product) => (
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
                  <h3 className="card-title text-lg leading-tight">
                    {product.name}
                  </h3>
                  <p className="text-base-content/60 text-sm">
                    {product.cafeName}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    {product.category && (
                      <div className="badge badge-outline">
                        {product.category}
                      </div>
                    )}
                    {product.price && (
                      <span className="font-semibold text-primary">
                        {product.price.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-base-300">
              <svg
                className="h-8 w-8 text-base-content/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>검색 결과 없음</title>
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="mb-2 font-semibold text-lg">검색 결과가 없습니다</h3>
            <p className="mb-4 text-base-content/60">
              다른 검색어를 시도하거나 필터를 조정해보세요.
            </p>
            {hasActiveFilters && (
              <button
                className="btn btn-primary"
                onClick={handleClearFilters}
                type="button"
              >
                모든 필터 초기화
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
