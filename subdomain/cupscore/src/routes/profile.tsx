import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRatingHistogram } from "~/components/reviews/UserRatingHistogram";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const { user, isLoaded } = useUser();

	// Get user's reviews
	const {
		data: userReviews = [],
		isLoading: reviewsLoading,
		error: reviewsError,
	} = useQuery({
		...convexQuery(api.reviews.getUserReviews, {
			userId: user?.id || "",
		}),
		enabled: !!user?.id,
	});

	// Get user's rating statistics
	const { data: userStats, isLoading: statsLoading } = useQuery({
		...convexQuery(api.reviews.getUserStats, {
			userId: user?.id || "",
		}),
		enabled: !!user?.id,
	});

	if (!isLoaded) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<span className="loading loading-spinner loading-lg" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<h1 className="mb-4 font-bold text-2xl">로그인이 필요합니다</h1>
					<p className="mb-6 text-base-content/70">
						프로필을 보려면 로그인해주세요.
					</p>
					<Link className="btn btn-primary" to="/">
						홈으로 가기
					</Link>
				</div>
			</div>
		);
	}

	const isLoading = reviewsLoading || statsLoading;

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			{/* Profile Header */}
			<div className="card mb-6 bg-base-100 shadow-md">
				<div className="card-body">
					<div className="flex items-center gap-4">
						{user.imageUrl && (
							<div className="avatar">
								<div className="h-16 w-16 rounded-full">
									<img
										alt={user.fullName || "프로필"}
										className="h-full w-full object-cover"
										src={user.imageUrl}
									/>
								</div>
							</div>
						)}
						<div className="flex-1">
							<h1 className="font-bold text-2xl">
								{user.fullName || user.firstName || "사용자"}
							</h1>
							{user.primaryEmailAddress && (
								<p className="text-base-content/70">
									{user.primaryEmailAddress.emailAddress}
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Rating Statistics */}
				<div className="lg:col-span-1">
					<div className="card bg-base-100 shadow-md">
						<div className="card-body">
							{isLoading ? (
								<div className="flex justify-center py-8">
									<span className="loading loading-spinner loading-md" />
								</div>
							) : userStats ? (
								<>
									<div className="mb-6 text-center">
										<div className="stat">
											<div className="stat-title">평균 평점</div>
											<div className="stat-value text-primary">
												{userStats.averageRating.toFixed(1)}
											</div>
											<div className="stat-desc">
												총 {userStats.totalReviews}개의 리뷰
											</div>
										</div>
									</div>

									<UserRatingHistogram
										ratingDistribution={userStats.ratingDistribution}
										totalReviews={userStats.totalReviews}
									/>
								</>
							) : (
								<div className="py-8 text-center">
									<p className="text-base-content/60">
										통계를 불러올 수 없습니다.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Review History */}
				<div className="lg:col-span-2">
					<div className="card bg-base-100 shadow-md">
						<div className="card-body">
							<h2 className="card-title mb-4">내 리뷰</h2>

							{isLoading ? (
								<div className="flex justify-center py-8">
									<span className="loading loading-spinner loading-md" />
								</div>
							) : reviewsError ? (
								<div className="py-8 text-center">
									<p className="mb-4 text-error">
										리뷰를 불러오는 중 오류가 발생했습니다.
									</p>
									<p className="text-base-content/60 text-sm">
										{String(reviewsError)}
									</p>
								</div>
							) : userReviews?.length > 0 ? (
								<div className="space-y-4">
									{userReviews.map((review) => (
										<div
											className="border-base-200 border-b pb-4 last:border-b-0 last:pb-0"
											key={review._id}
										>
											{/* Product link */}
											{review.product && (
												<div className="mb-3">
													<Link
														className="link link-primary font-medium"
														params={{ shortId: review.product.shortId }}
														to="/product/$shortId"
													>
														{review.product.name}
													</Link>
													<p className="text-base-content/60 text-sm">
														{new Date(review.createdAt).toLocaleDateString(
															"ko-KR",
														)}
														{review.updatedAt !== review.createdAt &&
															" (수정됨)"}
													</p>
												</div>
											)}

											{/* Review content */}
											<div className="pl-0">
												<div className="mb-2 flex items-center gap-2">
													<div className="badge badge-primary badge-md">
														{review.ratingLabel}
													</div>
												</div>

												{review.text && (
													<p className="mb-3 text-base-content">
														{review.text}
													</p>
												)}

												{review.imageUrls && review.imageUrls.length > 0 && (
													<div className="grid max-w-md grid-cols-2 gap-2">
														{review.imageUrls.map((imageUrl, index) => (
															<div
																className="aspect-square overflow-hidden rounded-lg"
																key={`${review._id}-image-${index}`}
															>
																<img
																	alt={`리뷰 이미지 ${index + 1}`}
																	className="h-full w-full object-cover"
																	src={imageUrl}
																/>
															</div>
														))}
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="py-8 text-center">
									<p className="mb-4 text-base-content/60">
										아직 작성한 리뷰가 없습니다.
									</p>
									<Link
										className="btn btn-primary"
										search={{ searchTerm: "", cafeId: "", category: "" }}
										to="/search"
									>
										상품 찾아보기
									</Link>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
