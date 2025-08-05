import { useUser } from '@clerk/tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../convex/_generated/api';

interface ClerkUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
  username?: string | null;
}

interface UserProfileProps {
  userId: string;
  className?: string;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map<string, ClerkUser>();

export function UserProfile({
  userId,
  className = '',
  showName = true,
  size = 'md',
}: UserProfileProps) {
  const { user: currentUser } = useUser();
  const [userProfile, setUserProfile] = useState<ClerkUser | null>(null);

  // Size configurations
  const sizeConfig = {
    sm: { avatar: 'h-8 w-8', text: 'text-xs' },
    md: { avatar: 'h-10 w-10', text: 'text-sm' },
    lg: { avatar: 'h-12 w-12', text: 'text-base' },
  };

  const config = sizeConfig[size];

  // Check if this is the current user
  const isCurrentUser = currentUser?.id === userId;

  // Fetch user profile data using Convex query
  const { data: fetchedUser, isLoading } = useQuery({
    ...convexQuery(api.users.getUserProfile, { userId }),
    enabled: !!userId && !isCurrentUser, // Don't fetch for current user
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Use current user data if it's the current user
  const currentUserProfile =
    isCurrentUser && currentUser
      ? {
          id: currentUser.id,
          firstName: currentUser.firstName || null,
          lastName: currentUser.lastName || null,
          fullName: currentUser.fullName || null,
          imageUrl: currentUser.imageUrl || null,
          username: currentUser.username || null,
        }
      : null;

  // Update user profile state
  useEffect(() => {
    if (currentUserProfile) {
      setUserProfile(currentUserProfile);
    } else if (fetchedUser) {
      setUserProfile(fetchedUser);
    }
  }, [currentUserProfile, fetchedUser]);

  // Loading state
  if (isLoading && !userProfile) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="avatar">
          <div
            className={`${config.avatar} animate-pulse rounded-full bg-base-300`}
          />
        </div>
        {showName && (
          <div className="h-4 w-20 animate-pulse rounded bg-base-300" />
        )}
      </div>
    );
  }

  // Get display data
  const displayName =
    userProfile?.fullName ||
    userProfile?.firstName ||
    userProfile?.username ||
    (isCurrentUser ? '나' : '익명 사용자');

  const imageUrl = userProfile?.imageUrl;
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* User Avatar */}
      <div className="avatar">
        <div
          className={`${config.avatar} flex items-center justify-center rounded-full bg-primary/10`}
        >
          {imageUrl ? (
            <img
              alt={displayName}
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = 'none';
              }}
              src={imageUrl}
            />
          ) : (
            <span className={`font-medium text-primary ${config.text}`}>
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* User Name */}
      {showName && (
        <span className={`font-medium ${config.text}`}>{displayName}</span>
      )}
    </div>
  );
}
