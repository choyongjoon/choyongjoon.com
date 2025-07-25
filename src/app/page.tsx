export default function Home() {
	return (
		<div className="card shadow-sm">
			<main className="card-body">
				<h1 className="card-title">choyongjoon.com</h1>
				<p>Personal website exploring ideas</p>
				<ol>
					<li className="mb-2 tracking-[-.01em]">
						<a className="link" href="https://old-blog.choyongjoon.com">
							Old blog
						</a>
					</li>
				</ol>
				<div className="divider"></div>
				<ol>
					<li>
						<a className="link" href="https://bsky.app/profile/choyongjoon.com">
							Bluesky
						</a>
					</li>
					<li>
						<a className="link" href="https://github.com/choyongjoon">
							GitHub
						</a>
					</li>
					<li>
						<a className="link" href="https://www.linkedin.com/in/choyongjoon/">
							LinkedIn
						</a>
					</li>
				</ol>
			</main>
		</div>
	);
}
