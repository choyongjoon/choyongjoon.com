import { Link } from '@tanstack/react-router';

interface FormData {
  name: string;
  handle: string;
}

interface ProfileFormProps {
  formData: FormData;
  isSubmitting: boolean;
  userLoading: boolean;
  isInitialSetup: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode; // For ProfileImageUpload component
}

export function ProfileForm({
  formData,
  isSubmitting,
  userLoading,
  onInputChange,
  onSubmit,
  isInitialSetup,
  children,
}: ProfileFormProps) {
  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body">
        <form className="space-y-6" onSubmit={onSubmit}>
          {/* Profile Image Section */}
          {children}

          {/* Name Field */}
          <div className="form-control">
            <label className="label" htmlFor="name">
              <span className="label-text font-medium">이름</span>
            </label>
            <input
              className="input input-bordered input-primary"
              id="name"
              name="name"
              onChange={onInputChange}
              placeholder="이름을 입력하세요"
              required
              type="text"
              value={formData.name}
            />
          </div>

          {/* Handle Field */}
          <div className="form-control">
            <label className="label" htmlFor="handle">
              <span className="label-text font-medium">핸들</span>
            </label>
            <input
              className="input input-bordered input-primary"
              id="handle"
              name="handle"
              onChange={onInputChange}
              pattern="^[a-zA-Z0-9_-]+$"
              placeholder="핸들을 입력하세요 (예: @myhandle)"
              required
              type="text"
              value={formData.handle}
            />
            <div className="label">
              <span className="label-text-alt">
                영문, 숫자, _, - 만 사용 가능합니다.
              </span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="form-control pt-4">
            <div className="flex justify-end gap-4">
              {!isInitialSetup && (
                <Link className="btn btn-ghost" to="/profile">
                  취소
                </Link>
              )}
              <button
                className="btn btn-primary"
                disabled={isSubmitting || userLoading}
                type="submit"
              >
                {(() => {
                  if (isSubmitting) {
                    return (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        저장 중...
                      </>
                    );
                  }
                  if (isInitialSetup) {
                    return '프로필 설정 완료';
                  }
                  return '변경사항 저장';
                })()}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
