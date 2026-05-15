import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Known allowed folders for uploads
const ALLOWED_FOLDERS = ['avatars', 'dogs', 'walks'];

export const generateUploadSignature = action({
  args: {
    folder: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Require authentication to prevent abuse
    const user = await ctx.runQuery(api.users.getCurrent, {});
    if (!user) {
      throw new Error('Not authenticated');
    }

    // SECURITY: Validate folder is either a known folder or user-namespaced
    const userPrefix = `users/${user._id}/`;
    const isAllowedFolder = ALLOWED_FOLDERS.includes(args.folder);
    const isUserNamespaced = args.folder.startsWith(userPrefix);

    if (!isAllowedFolder && !isUserNamespaced) {
      throw new Error(`Folder must be one of [${ALLOWED_FOLDERS.join(', ')}] or start with ${userPrefix}`);
    }

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      throw new Error('Cloudinary credentials not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${args.folder}&timestamp=${timestamp}`;

    // Generate SHA-1 signature
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign + API_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return {
      signature,
      timestamp,
      apiKey: API_KEY,
      cloudName: CLOUD_NAME,
      folder: args.folder,
    };
  },
});
