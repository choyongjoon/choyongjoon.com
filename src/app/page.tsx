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
              rel="noopener"
              target="_blank"
            >
              Old blog
            </a>
          </li>
        </ol>
        <div className="divider" />
        <ol>
          <li>
            <a
              className="link"
              href="https://bsky.app/profile/choyongjoon.com"
              rel="noopener"
              target="_blank"
            >
              Bluesky
            </a>
          </li>
          <li>
            <a
              className="link"
              href="https://github.com/choyongjoon"
              rel="noopener"
              target="_blank"
            >
              GitHub
            </a>
          </li>
          <li>
            <a
              className="link"
              href="https://www.linkedin.com/in/choyongjoon/"
              rel="noopener"
              target="_blank"
            >
              LinkedIn
            </a>
          </li>
        </ol>
      </main>
    </div>
  );
}
