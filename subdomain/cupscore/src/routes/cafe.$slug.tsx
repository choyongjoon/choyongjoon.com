import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/cafe/$slug")({
	component: CafePage,
	loader: async (opts) => {
		await opts.context.queryClient.ensureQueryData(
			convexQuery(api.cafes.getBySlug, { slug: opts.params.slug }),
		);
	},
});

function CafePage() {
	const { slug } = Route.useParams();
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	const { data: cafe } = useSuspenseQuery(
		convexQuery(api.cafes.getBySlug, { slug }),
	);
	const { data: products } = useSuspenseQuery(
		convexQuery(api.products.getByCafe, { cafeId: cafe!._id }),
	);

	const categories = Array.from(
		new Set(products?.map((p) => p.category) || []),
	);
	const filteredProducts =
		selectedCategory === "all"
			? products
			: products?.filter((p) => p.category === selectedCategory);

	return (
		<div className="min-h-screen bg-base-100">
			{/* Cafe Header */}
			<div className="bg-primary text-primary-content py-12">
				<div className="container mx-auto px-4">
					<div className="flex items-center gap-6">
						<div className="w-20 h-20 bg-primary-content/20 rounded-full flex items-center justify-center">
							<span className="text-4xl">☕</span>
						</div>
						<div>
							<h1 className="text-4xl font-bold">{cafe?.name}</h1>
							<p className="text-lg opacity-90 mt-2">
								{products?.length || 0}개의 상품
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 py-8">
				{/* Category Filter */}
				<div className="mb-8">
					<h2 className="text-xl font-semibold mb-4">카테고리</h2>
					<div className="flex flex-wrap gap-2">
						<button
							className={`btn btn-sm ${selectedCategory === "all" ? "btn-primary" : "btn-outline"}`}
							onClick={() => setSelectedCategory("all")}
						>
							전체
						</button>
						{categories.map((category) => (
							<button
								key={category}
								className={`btn btn-sm ${selectedCategory === category ? "btn-primary" : "btn-outline"}`}
								onClick={() => setSelectedCategory(category)}
							>
								{category}
							</button>
						))}
					</div>
				</div>

				{/* Products Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredProducts?.map((product) => (
						<div
							key={product._id}
							className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow"
						>
							<div className="card-body">
								<h3 className="card-title">{product.name}</h3>
								<p className="text-base-content/70 text-sm mb-2">
									{product.category}
								</p>
								{product.description && (
									<p className="text-sm mb-3">{product.description}</p>
								)}
								<div className="flex justify-between items-center">
									<div className="space-y-1">
										{product.price && (
											<p className="text-lg font-bold text-primary">
												{product.price.toLocaleString()}원
											</p>
										)}
										{product.calories && (
											<p className="text-xs text-base-content/60">
												{product.calories}kcal
											</p>
										)}
									</div>
									{product.isDiscontinued && (
										<div className="badge badge-error">단종</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>

				{filteredProducts?.length === 0 && (
					<div className="text-center py-12">
						<p className="text-base-content/70">상품이 없습니다.</p>
					</div>
				)}
			</div>
		</div>
	);
}
