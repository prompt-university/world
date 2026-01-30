import { httpAction } from '../_generated/server';
import { api } from '../_generated/api';

// ============================================================================
// CLAWDBOT HTTP ENDPOINTS
// REST API for Clawdbot instances to interact with Prompt University
// ============================================================================

/**
 * POST /clawdbot/register
 * Register a Clawdbot instance to join the world
 */
export const registerHandler = httpAction(async (ctx, request) => {
  const body = await request.json();
  
  const { gatewayUrl, apiToken, name, soul, avatar } = body;
  
  if (!gatewayUrl || !apiToken || !name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: gatewayUrl, apiToken, name' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const result = await ctx.runMutation(api.clawdbot.bridge.register, {
      gatewayUrl,
      apiToken,
      name,
      soul,
      avatar,
    });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * POST /clawdbot/heartbeat
 * Keep-alive ping from Clawdbot
 */
export const heartbeatHandler = httpAction(async (ctx, request) => {
  const apiToken = request.headers.get('X-Clawdbot-Token');
  
  if (!apiToken) {
    return new Response(
      JSON.stringify({ error: 'Missing X-Clawdbot-Token header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const result = await ctx.runMutation(api.clawdbot.bridge.heartbeat, { apiToken });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * GET /clawdbot/world
 * Get current world state for a Clawdbot
 */
export const worldStateHandler = httpAction(async (ctx, request) => {
  const apiToken = request.headers.get('X-Clawdbot-Token');
  
  if (!apiToken) {
    return new Response(
      JSON.stringify({ error: 'Missing X-Clawdbot-Token header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const result = await ctx.runQuery(api.clawdbot.bridge.getWorldState, { apiToken });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * POST /clawdbot/action
 * Submit an action from a Clawdbot
 */
export const actionHandler = httpAction(async (ctx, request) => {
  const apiToken = request.headers.get('X-Clawdbot-Token');
  
  if (!apiToken) {
    return new Response(
      JSON.stringify({ error: 'Missing X-Clawdbot-Token header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json();
  const { action } = body;

  if (!action || !action.type) {
    return new Response(
      JSON.stringify({ error: 'Missing action.type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const result = await ctx.runMutation(api.clawdbot.bridge.submitAction, {
      apiToken,
      action,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * GET /clawdbot/online
 * List all online Clawdbots (public endpoint for spectators)
 */
export const onlineHandler = httpAction(async (ctx, request) => {
  try {
    const result = await ctx.runQuery(api.clawdbot.bridge.listOnline, {});
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
