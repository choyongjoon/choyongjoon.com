import { Link } from '@tanstack/react-router';

export function SettingsHeader({
  isInitialSetup,
}: {
  isInitialSetup: boolean;
}) {
  return (
    <div className="mb-6">
      {!isInitialSetup && (
        <div className="mb-4 flex items-center gap-4">
          <Link className="btn btn-ghost btn-sm" to="/profile">
            ← 프로필로 돌아가기
          </Link>
        </div>
      )}

      <h1 className="font-bold text-3xl">
        {isInitialSetup ? '환영합니다!' : '프로필 설정'}
      </h1>

      <p className="mt-2 text-base-content/70">
        {isInitialSetup
          ? '잔점에 오신 것을 환영합니다! 프로필을 설정해주세요.'
          : '프로필 정보를 수정할 수 있습니다.'}
      </p>

      {isInitialSetup && (
        <div className="alert alert-info mt-4">
          <span>
            처음 가입하셨군요! 이름과 핸들을 설정하여 다른 사용자들과 구별되는
            프로필을 만들어보세요.
          </span>
        </div>
      )}
    </div>
  );
}
