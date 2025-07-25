export default function Home() {
	return (
		<div className="card shadow-sm">
			<main className="card-body">
				<h1 className="card-title">choyongjoon.com</h1>
				<p>Personal website exploring ideas</p>
				<ol>
					<li className="mb-2 tracking-[-.01em]">
						<a
							className="link"
							href="https://old-blog.choyongjoon.com"
							target="_blank"
							rel="noopener"
						>
							Old blog
						</a>
					</li>
				</ol>
				<div className="divider"></div>
				<ol>
					<li>
						<a
							className="link"
							href="https://bsky.app/profile/choyongjoon.com"
							target="_blank"
							rel="noopener"
						>
							Bluesky
						</a>
					</li>
					<li>
						<a
							className="link"
							href="https://github.com/choyongjoon"
							target="_blank"
							rel="noopener"
						>
							GitHub
						</a>
					</li>
					<li>
						<a
							className="link"
							href="https://www.linkedin.com/in/choyongjoon/"
							target="_blank"
							rel="noopener"
						>
							LinkedIn
						</a>
					</li>
				</ol>
			</main>
		</div>
	);
}
