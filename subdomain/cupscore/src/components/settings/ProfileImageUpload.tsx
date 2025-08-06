import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

interface ProfileImageUploadProps {
  previewUrl: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileImageUpload({
  previewUrl,
  onImageChange,
}: ProfileImageUploadProps) {
  const { data: currentUser } = useQuery(convexQuery(api.users.current, {}));

  // Get current user's profile image URL from Convex storage
  const { data: currentUserImageUrl } = useQuery({
    ...convexQuery(api.users.getImageUrl, {
      storageId: currentUser?.imageStorageId as Id<'_storage'>,
    }),
    enabled: !!currentUser?.imageStorageId,
  });

  const renderProfileImage = () => {
    if (previewUrl) {
      return (
        <img
          alt="새 프로필 이미지"
          className="h-full w-full object-cover"
          src={previewUrl}
        />
      );
    }
    if (currentUserImageUrl) {
      return (
        <img
          alt="현재 프로필 이미지"
          className="h-full w-full object-cover"
          src={currentUserImageUrl}
        />
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-base-200">
        <span className="text-2xl">👤</span>
      </div>
    );
  };

  return (
    <div className="form-control">
      <label className="label" htmlFor="profile-image">
        <span className="label-text font-medium">프로필 이미지</span>
      </label>

      <div className="flex items-center gap-6">
        {/* Current/Preview Image */}
        <div className="avatar">
          <div className="h-24 w-24 rounded-full ring ring-primary ring-offset-2 ring-offset-base-100">
            {renderProfileImage()}
          </div>
        </div>

        {/* Upload Button */}
        <div>
          <input
            accept="image/*"
            className="file-input file-input-bordered file-input-primary w-full max-w-xs"
            id="profile-image"
            onChange={onImageChange}
            type="file"
          />
          <div className="label">
            <span className="label-text-alt">JPG, PNG 파일만 지원됩니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
