export default {
  providers: [
    {
      domain: 'https://appleid.apple.com',
      applicationID: process.env.AUTH_APPLE_CLIENT_ID!,
    },
    {
      // Google Web Client ID (for web builds)
      domain: 'https://accounts.google.com',
      applicationID: process.env.AUTH_GOOGLE_CLIENT_ID!,
    },
    {
      // Google iOS Client ID (for iOS builds - tokens have different audience)
      domain: 'https://accounts.google.com',
      applicationID: process.env.AUTH_GOOGLE_IOS_CLIENT_ID!,
    },
  ],
};
