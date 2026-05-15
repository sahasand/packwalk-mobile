import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const locationSnapshot = v.object({
  lat: v.number(),
  lng: v.number(),
  geohash: v.string(),
  addressLine1: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const statusHistoryEntry = v.object({
  status: v.string(),
  timestamp: v.number(),
  actor: v.string(),
});

const dayAvailability = v.object({
  enabled: v.boolean(),
  startTime: v.string(), // HH:MM format
  endTime: v.string(), // HH:MM format
});

const availabilitySchema = v.object({
  monday: v.optional(dayAvailability),
  tuesday: v.optional(dayAvailability),
  wednesday: v.optional(dayAvailability),
  thursday: v.optional(dayAvailability),
  friday: v.optional(dayAvailability),
  saturday: v.optional(dayAvailability),
  sunday: v.optional(dayAvailability),
});

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    userType: v.union(v.literal('owner'), v.literal('walker'), v.literal('admin')),
    walkerVerificationStatus: v.union(
      v.literal('unverified'),
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
    ),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    avatarFileId: v.optional(v.id('_storage')),
    avatarUrl: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeConnectAccountId: v.optional(v.string()),
    stripeConnectStatus: v.union(
      v.literal('not_started'),
      v.literal('onboarding'),
      v.literal('pending_verification'),
      v.literal('active'),
      v.literal('restricted'),
      v.literal('disabled'),
    ),
    stripeConnectStatusReason: v.optional(v.string()),
    pushTokens: v.array(v.string()),
    defaultLocation: v.optional(locationSnapshot),
    timezone: v.optional(v.string()),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_authId', ['authId'])
    .index('by_email', ['email'])
    .index('by_userType', ['userType'])
    .index('by_isDeleted', ['isDeleted'])
    .index('by_stripeConnectStatus', ['stripeConnectStatus']),

  dogs: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    breed: v.optional(v.string()),
    age: v.optional(v.number()),
    size: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    photoFileId: v.optional(v.id('_storage')),
    photoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    accessNotes: v.optional(v.string()),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_ownerId_isActive', ['ownerId', 'isActive'])
    .index('by_ownerId_isDeleted', ['ownerId', 'isDeleted']),

  walkerProfiles: defineTable({
    userId: v.id('users'),
    hourlyRate: v.number(),
    bio: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    serviceAreas: v.array(v.string()),
    maxDistanceKm: v.number(),
    availability: v.optional(availabilitySchema),
    avgRating: v.number(),
    reviewCount: v.number(),
    isVisible: v.boolean(),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        geohash: v.string(),
      }),
    ),
    geohash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_isVisible', ['isVisible'])
    .index('by_avgRating', ['avgRating'])
    .index('by_geohash', ['geohash']),

  walkRequests: defineTable({
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    dogIds: v.array(v.id('dogs')),
    scheduledTime: v.number(),
    durationMinutes: v.number(),
    pickupLocation: locationSnapshot,
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('declined'),
      v.literal('expired'),
      v.literal('cancelled'),
    ),
    expiresAt: v.number(),
    quotedPrice: v.number(),
    currency: v.string(),
    platformFeePercent: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeIdempotencyKey: v.optional(v.string()),
    message: v.optional(v.string()),
    statusHistory: v.array(statusHistoryEntry),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_walkerId_status', ['walkerId', 'status'])
    .index('by_ownerId', ['ownerId'])
    .index('by_expiresAt', ['expiresAt'])
    .index('by_ownerId_status', ['ownerId', 'status']),

  walks: defineTable({
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    dogIds: v.array(v.id('dogs')),
    requestId: v.id('walkRequests'),
    status: v.union(
      v.literal('scheduled'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('cancelled'),
      v.literal('no_show'),
    ),
    scheduledTime: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    pickupLocationSnapshot: locationSnapshot,
    lastLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        timestamp: v.number(),
        accuracy: v.optional(v.number()),
      }),
    ),
    distanceMeters: v.optional(v.number()),
    totalPrice: v.number(),
    walkerShare: v.number(),
    platformFee: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeRefundId: v.optional(v.string()),
    refundStatus: v.union(v.literal('none'), v.literal('partial'), v.literal('full')),
    donationAggregated: v.boolean(),
    disputeHoldUntil: v.optional(v.number()),
    statusHistory: v.array(statusHistoryEntry),
    sensitiveNotes: v.optional(v.string()),
    sensitiveNotesIv: v.optional(v.string()),
    sensitiveNotesKeyVersion: v.optional(v.number()),
    sensitiveNotesExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerId_status', ['ownerId', 'status'])
    .index('by_ownerId_status_scheduledTime', ['ownerId', 'status', 'scheduledTime'])
    .index('by_walkerId_status', ['walkerId', 'status'])
    .index('by_walkerId_status_scheduledTime', ['walkerId', 'status', 'scheduledTime'])
    .index('by_scheduledTime', ['scheduledTime']),

  walkLocations: defineTable({
    walkId: v.id('walks'),
    lat: v.number(),
    lng: v.number(),
    timestamp: v.number(),
    accuracy: v.optional(v.number()),
    seq: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_walkId_timestamp', ['walkId', 'timestamp'])
    .index('by_walkId', ['walkId']),

  earnings: defineTable({
    walkerId: v.id('users'),
    type: v.union(v.literal('walk'), v.literal('tip'), v.literal('adjustment')),
    sourceId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(v.literal('pending'), v.literal('ready_for_payout'), v.literal('paid_out')),
    stripeTransferId: v.optional(v.string()),
    stripeIdempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_walkerId_status', ['walkerId', 'status'])
    .index('by_walkerId_type', ['walkerId', 'type']),

  reviews: defineTable({
    walkId: v.id('walks'),
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    rating: v.number(),
    comment: v.optional(v.string()),
    tipAmount: v.optional(v.number()),
    tipPlatformFee: v.optional(v.number()), // 20% of tip for shelter donations
    currency: v.string(),
    tipPaymentIntentId: v.optional(v.string()),
    tipStatus: v.union(
      v.literal('none'),
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
    ),
    createdAt: v.number(),
  })
    .index('by_walkerId', ['walkerId'])
    .index('by_walkId', ['walkId'])
    .index('by_ownerId', ['ownerId']),

  conversations: defineTable({
    ownerId: v.id('users'),
    walkerId: v.id('users'),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.id('users')),
    unreadCountOwner: v.number(),
    unreadCountWalker: v.number(),
    createdAt: v.number(),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_walkerId', ['walkerId']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderId: v.id('users'),
    body: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  }).index('by_conversationId_createdAt', ['conversationId', 'createdAt']),

  notifications: defineTable({
    userId: v.id('users'),
    type: v.union(
      v.literal('walk_request'),
      v.literal('walk_update'),
      v.literal('message'),
      v.literal('payout_update'),
      v.literal('review'),
      v.literal('system'),
    ),
    data: v.any(),
    isRead: v.boolean(),
    createdAt: v.number(),
  }).index('by_userId_isRead_createdAt', ['userId', 'isRead', 'createdAt']),

  shelters: defineTable({
    name: v.string(),
    contactEmail: v.optional(v.string()),
    payoutMethod: v.union(v.literal('manual'), v.literal('stripe')),
    stripeConnectAccountId: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_isActive', ['isActive'])
    .index('by_name', ['name']),

  shelterDonations: defineTable({
    month: v.number(),
    year: v.number(),
    shelterId: v.id('shelters'),
    shelterName: v.string(),
    payoutMethodSnapshot: v.union(v.literal('manual'), v.literal('stripe')),
    amount: v.number(),
    currency: v.string(),
    walkCount: v.number(),
    status: v.union(v.literal('pending'), v.literal('transferred'), v.literal('confirmed')),
    stripeTransferId: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
    impactMetric: v.optional(v.string()),
    disputeHoldUntil: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    donatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_month_year', ['month', 'year'])
    .index('by_status', ['status'])
    .index('by_shelterId', ['shelterId']),

  backgroundChecks: defineTable({
    walkerId: v.id('users'),
    certnApplicationId: v.string(),
    status: v.union(
      v.literal('submitted'),
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('expired'),
    ),
    result: v.optional(v.any()),
    submittedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_walkerId', ['walkerId'])
    .index('by_status', ['status'])
    .index('by_expiresAt', ['expiresAt']),

  auditLog: defineTable({
    actor: v.id('users'),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_actor', ['actor'])
    .index('by_resourceType_resourceId', ['resourceType', 'resourceId'])
    .index('by_createdAt', ['createdAt']),

  webhookEvents: defineTable({
    provider: v.union(v.literal('stripe'), v.literal('certn'), v.literal('resend')),
    eventType: v.string(),
    eventId: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal('received'),
      v.literal('processing'), // Claimed but not yet completed
      v.literal('processed'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()),
    attempts: v.number(),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_provider_eventId', ['provider', 'eventId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  emailLogs: defineTable({
    userId: v.optional(v.id('users')),
    template: v.string(),
    providerMessageId: v.optional(v.string()),
    status: v.union(
      v.literal('queued'),
      v.literal('sent'),
      v.literal('delivered'),
      v.literal('bounced'),
      v.literal('failed'),
    ),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_status', ['status'])
    .index('by_providerMessageId', ['providerMessageId']),

  stripeErrors: defineTable({
    context: v.string(),
    relatedRequestId: v.optional(v.id('walkRequests')),
    relatedWalkId: v.optional(v.id('walks')),
    idempotencyKey: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.string(),
    attempt: v.number(),
    createdAt: v.number(),
  })
    .index('by_context', ['context'])
    .index('by_createdAt', ['createdAt']),

  rateLimits: defineTable({
    subject: v.string(),
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
    expiresAt: v.number(),
  })
    .index('by_subject_key', ['subject', 'key'])
    .index('by_expiresAt', ['expiresAt']),

  // Waitlist for early access signups
  waitlist: defineTable({
    email: v.string(),
    type: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  }),
});