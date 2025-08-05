import { createClerkClient } from '@clerk/backend';
import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Get user profile information from Clerk using the official SDK
 */
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (_, { userId }) => {
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        // Fallback for development/testing
        return {
          id: userId,
          firstName: null,
          lastName: null,
          fullName: '익명 사용자',
          imageUrl: null,
          username: null,
        };
      }

      // Initialize Clerk client with secret key
      const clerk = createClerkClient({ secretKey: clerkSecretKey });

      // Fetch user from Clerk using official SDK
      const user = await clerk.users.getUser(userId);

      return {
        id: user.id,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        fullName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || '익명 사용자',
        imageUrl: user.imageUrl || null,
        username: user.username || null,
      };
    } catch {
      // Return fallback profile if user fetch fails
      return {
        id: userId,
        firstName: null,
        lastName: null,
        fullName: '익명 사용자',
        imageUrl: null,
        username: null,
      };
    }
  },
});
