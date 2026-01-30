import { httpRouter } from 'convex/server';
import { handleReplicateWebhook } from './music';
import {
  registerHandler,
  heartbeatHandler,
  worldStateHandler,
  actionHandler,
  onlineHandler,
} from './clawdbot/http';

const http = httpRouter();

// Replicate webhook (music generation)
http.route({
  path: '/replicate_webhook',
  method: 'POST',
  handler: handleReplicateWebhook,
});

// ============================================================================
// CLAWDBOT FEDERATION API
// Endpoints for external Clawdbot instances to join and interact
// ============================================================================

http.route({
  path: '/clawdbot/register',
  method: 'POST',
  handler: registerHandler,
});

http.route({
  path: '/clawdbot/heartbeat',
  method: 'POST',
  handler: heartbeatHandler,
});

http.route({
  path: '/clawdbot/world',
  method: 'GET',
  handler: worldStateHandler,
});

http.route({
  path: '/clawdbot/action',
  method: 'POST',
  handler: actionHandler,
});

http.route({
  path: '/clawdbot/online',
  method: 'GET',
  handler: onlineHandler,
});

export default http;
