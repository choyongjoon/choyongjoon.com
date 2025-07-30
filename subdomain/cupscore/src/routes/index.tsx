import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { data: cafes } = useSuspenseQuery(convexQuery(api.cafes.list, {}));
  const { data: totalProducts } = useSuspenseQuery(
    convexQuery(api.stats.getTotalProductCount, {})
  );

  return (
    <div className="min-h-screen bg-base-100">
      {/* Hero Section */}
      <div className="hero bg-gradient-to-r from-primary to-secondary py-16 text-primary-content">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="mb-5 font-bold text-5xl">컵스코어</h1>
            <p className="mb-5 text-lg">
              카페 음료의 모든 것을 한곳에서!
              <br />
              인플루언서 리뷰부터 개인별 평점까지
            </p>
            <div className="stats bg-base-100 text-base-content shadow">
              <div className="stat">
                <div className="stat-title">등록된 상품</div>
                <div className="stat-value text-primary">
                  {totalProducts || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Cafe List Section */}
        <div className="mb-8 text-center">
          <h2 className="mb-4 font-bold text-3xl">카페 브랜드</h2>
          <p className="mb-8 text-base-content/70">
            원하는 카페를 선택해서 메뉴를 확인하세요
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {cafes?.map((cafe) => (
            <Link
              className="card cursor-pointer bg-base-200 transition-all duration-200 hover:bg-base-300 hover:shadow-lg"
              key={cafe._id}
              params={{ slug: cafe.slug }}
              to="/cafe/$slug"
            >
              <div className="card-body items-center p-6 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-2xl">☕</span>
                </div>
                <h3 className="card-title text-lg">{cafe.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
