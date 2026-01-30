import { v } from 'convex/values';
import { mutation, query, action, internalMutation, internalAction, internalQuery } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { Id, Doc } from '../_generated/dataModel';

// ============================================================================
// CLAWDBOT BRIDGE
// Connects external Clawdbot instances to Prompt University world
// ============================================================================

/**
 * Register a Clawdbot instance to join the world
 */
export const register = mutation({
  args: {
    gatewayUrl: v.string(),
    apiToken: v.string(),
    name: v.string(),
    soul: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already registered
    const existing = await ctx.db
      .query('clawdbots')
      .withIndex('by_token', (q) => q.eq('apiToken', args.apiToken))
      .first();

    if (existing) {
      // Update existing registration
      await ctx.db.patch(existing._id, {
        gatewayUrl: args.gatewayUrl,
        name: args.name,
        lastHeartbeat: Date.now(),
        status: 'online',
        soul: args.soul,
        avatar: args.avatar,
      });
      return { clawdbotId: existing._id, playerId: existing.playerId };
    }

    // Create new registration
    const clawdbotId = await ctx.db.insert('clawdbots', {
      gatewayUrl: args.gatewayUrl,
      apiToken: args.apiToken,
      name: args.name,
      lastHeartbeat: Date.now(),
      status: 'online',
      soul: args.soul,
      avatar: args.avatar,
    });

    return { clawdbotId, playerId: null };
  },
});

/**
 * Heartbeat from Clawdbot to stay online
 */
export const heartbeat = mutation({
  args: {
    apiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const clawdbot = await ctx.db
      .query('clawdbots')
      .withIndex('by_token', (q) => q.eq('apiToken', args.apiToken))
      .first();

    if (!clawdbot) {
      throw new Error('Clawdbot not registered');
    }

    await ctx.db.patch(clawdbot._id, {
      lastHeartbeat: Date.now(),
      status: 'online',
    });

    return { ok: true };
  },
});

/**
 * Get world state visible to a Clawdbot's player
 */
export const getWorldState = query({
  args: {
    apiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const clawdbot = await ctx.db
      .query('clawdbots')
      .withIndex('by_token', (q) => q.eq('apiToken', args.apiToken))
      .first();

    if (!clawdbot) {
      throw new Error('Clawdbot not registered');
    }

    if (!clawdbot.playerId) {
      return { spawned: false, world: null };
    }

    // Get all worlds (typically just one)
    const worlds = await ctx.db.query('worlds').collect();
    if (worlds.length === 0) {
      return { spawned: true, world: null };
    }

    const world = worlds[0];

    // Get player descriptions for this world
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();

    // Create a map of playerId -> player description
    const playerDescMap = new Map(playerDescriptions.map((pd) => [pd.playerId, pd]));

    // Get active conversations
    const conversations = world.conversations || [];

    // Get recent messages for this world
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(50);

    // Format for Clawdbot consumption
    return {
      spawned: true,
      world: {
        id: world._id,
        players: (world.players || []).map((p) => {
          const desc = playerDescMap.get(p.id);
          return {
            id: p.id,
            name: desc?.name ?? 'Unknown',
            description: desc?.description ?? '',
            x: p.position?.x ?? 0,
            y: p.position?.y ?? 0,
            isYou: p.id === clawdbot.playerId,
          };
        }),
        conversations: conversations.map((c) => ({
          id: c.id,
          participants: c.participants.map((p) => p.playerId),
          numMessages: c.numMessages,
        })),
        recentMessages: messages.map((m) => ({
          author: m.author,
          text: m.text,
          timestamp: m._creationTime,
        })),
        yourPlayer: clawdbot.playerId,
      },
    };
  },
});

/**
 * Submit an action from a Clawdbot
 */
export const submitAction = mutation({
  args: {
    apiToken: v.string(),
    action: v.object({
      type: v.union(
        v.literal('move'),
        v.literal('say'),
        v.literal('startConversation'),
        v.literal('leaveConversation'),
        v.literal('emote'),
      ),
      target: v.optional(v.string()),
      message: v.optional(v.string()),
      x: v.optional(v.number()),
      y: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const clawdbot = await ctx.db
      .query('clawdbots')
      .withIndex('by_token', (q) => q.eq('apiToken', args.apiToken))
      .first();

    if (!clawdbot) {
      throw new Error('Clawdbot not registered');
    }

    if (!clawdbot.playerId) {
      throw new Error('Clawdbot not spawned in world');
    }

    // Queue the action for processing
    const actionId = await ctx.db.insert('clawdbotActions', {
      clawdbotId: clawdbot._id,
      playerId: clawdbot.playerId,
      action: args.action,
      status: 'pending',
      createdAt: Date.now(),
    });

    return { actionId, queued: true };
  },
});

/**
 * List all online Clawdbots (for spectator mode)
 */
export const listOnline = query({
  args: {},
  handler: async (ctx) => {
    const clawdbots = await ctx.db
      .query('clawdbots')
      .filter((q) => q.eq(q.field('status'), 'online'))
      .collect();

    return clawdbots.map((c) => ({
      id: c._id,
      name: c.name,
      playerId: c.playerId,
      avatar: c.avatar,
    }));
  },
});

/**
 * Send a world prompt to a specific Clawdbot (via their gateway)
 * This is called by the game engine when it's time for an agent to act
 */
export const promptClawdbot = internalAction({
  args: {
    clawdbotId: v.id('clawdbots'),
    prompt: v.string(),
    context: v.object({
      playerId: v.string(),
      location: v.object({ x: v.number(), y: v.number() }),
      nearbyPlayers: v.array(v.object({
        id: v.string(),
        name: v.string(),
        distance: v.number(),
      })),
      currentConversation: v.optional(v.string()),
      recentEvents: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const clawdbot = await ctx.runQuery(internal.clawdbot.bridge.getClawdbotById, {
      clawdbotId: args.clawdbotId,
    });

    if (!clawdbot) {
      throw new Error('Clawdbot not found');
    }

    // Format the world state as a prompt for the Clawdbot
    const worldPrompt = formatWorldPrompt(args.prompt, args.context);

    // Send to Clawdbot Gateway
    // In production, this would call the gateway's API
    // For now, we'll use a webhook-style approach
    try {
      const response = await fetch(`${clawdbot.gatewayUrl}/api/prompt-university/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PU-Token': clawdbot.apiToken,
        },
        body: JSON.stringify({
          prompt: worldPrompt,
          context: args.context,
          replyUrl: `${process.env.CONVEX_SITE_URL}/clawdbot/action`,
        }),
      });

      if (!response.ok) {
        console.error('Failed to prompt Clawdbot:', await response.text());
      }
    } catch (error) {
      console.error('Error prompting Clawdbot:', error);
    }
  },
});

export const getClawdbotById = internalQuery({
  args: { clawdbotId: v.id('clawdbots') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.clawdbotId);
  },
});

// Helper to format world state into a natural language prompt
function formatWorldPrompt(
  basePrompt: string,
  context: {
    playerId: string;
    location: { x: number; y: number };
    nearbyPlayers: { id: string; name: string; distance: number }[];
    currentConversation?: string;
    recentEvents: string[];
  }
): string {
  const lines = [basePrompt, '', '## Current Situation'];

  lines.push(`You are at position (${context.location.x}, ${context.location.y}).`);

  if (context.nearbyPlayers.length > 0) {
    lines.push('', 'Nearby:');
    for (const player of context.nearbyPlayers) {
      lines.push(`- ${player.name} (${player.distance} tiles away)`);
    }
  } else {
    lines.push('', 'No one is nearby.');
  }

  if (context.currentConversation) {
    lines.push('', `You are currently in a conversation.`);
  }

  if (context.recentEvents.length > 0) {
    lines.push('', 'Recent events:');
    for (const event of context.recentEvents) {
      lines.push(`- ${event}`);
    }
  }

  lines.push('', '## Available Actions');
  lines.push('- move(x, y) - Walk to a location');
  lines.push('- say("message") - Say something');
  lines.push('- startConversation(playerName) - Start talking to someone');
  lines.push('- leaveConversation() - End current conversation');
  lines.push('- emote("action") - Express an emotion or action');
  lines.push('', 'What do you do?');

  return lines.join('\n');
}
