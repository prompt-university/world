import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Schema for registered Clawdbot agents
export const clawdbotTables = {
  // Registered Clawdbot instances that can control agents
  clawdbots: defineTable({
    // Gateway URL for this Clawdbot instance
    gatewayUrl: v.string(),
    // API token for authentication
    apiToken: v.string(),
    // Display name for this Clawdbot
    name: v.string(),
    // Associated player ID in the game world (if spawned)
    playerId: v.optional(v.string()),
    // Last heartbeat timestamp
    lastHeartbeat: v.number(),
    // Status
    status: v.union(v.literal('online'), v.literal('offline'), v.literal('busy')),
    // Custom personality/soul (optional override)
    soul: v.optional(v.string()),
    // Custom avatar sprite (optional)
    avatar: v.optional(v.string()),
  })
    .index('by_token', ['apiToken'])
    .index('by_player', ['playerId']),

  // Pending actions from Clawdbots
  clawdbotActions: defineTable({
    clawdbotId: v.id('clawdbots'),
    playerId: v.string(),
    action: v.object({
      type: v.union(
        v.literal('move'),
        v.literal('say'),
        v.literal('startConversation'),
        v.literal('leaveConversation'),
        v.literal('emote'),
      ),
      target: v.optional(v.string()), // Player ID or location
      message: v.optional(v.string()),
      x: v.optional(v.number()),
      y: v.optional(v.number()),
    }),
    status: v.union(v.literal('pending'), v.literal('processed'), v.literal('failed')),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_status', ['status'])
    .index('by_clawdbot', ['clawdbotId']),

  // World state snapshots sent to Clawdbots
  clawdbotWorldSnapshots: defineTable({
    clawdbotId: v.id('clawdbots'),
    playerId: v.string(),
    snapshot: v.string(), // JSON snapshot of visible world state
    createdAt: v.number(),
  }).index('by_clawdbot', ['clawdbotId']),
};
