import { Link } from '@tanstack/react-router';

export function NavBar() {
  return (
    <div className="navbar bg-primary text-primary-content shadow-sm">
      <div className="navbar-start">
        {/* <div className="dropdown">
          <div className="btn btn-ghost btn-circle" role="button" tabIndex={0}>
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {' '}
              <path
                d="M4 6h16M4 12h16M4 18h7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />{' '}
            </svg>
          </div>
          <ul
            className="menu menu-sm dropdown-content z-1 mt-3 w-52 rounded-box bg-base-100 p-2 shadow"
            tabIndex={0}
          >
            <li>
              <a>Homepage</a>
            </li>
            <li>
              <a>Portfolio</a>
            </li>
            <li>
              <a>About</a>
            </li>
          </ul>
        </div> */}
      </div>
      <div className="navbar-center">
        <Link className="btn btn-ghost font-sunflower text-xl" to="/">
          잔점
        </Link>
      </div>
      <div className="navbar-end">
        <Link className="btn btn-ghost btn-circle" to="/search">
          <svg
            aria-label="Search"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Search</title>
            <path
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
