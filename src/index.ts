import assert from 'node:assert';
import {
  ChannelType,
  Client,
  GatewayDispatchEvents,
  GatewayIntentBits,
} from '@discordjs/core';
import {REST} from '@discordjs/rest';
import {WebSocketManager} from '@discordjs/ws';
import {ChannelLimiterManager} from './manager';

const token = process.env.DISCORD_TOKEN!;

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages,
  rest,
  token,
});

const cm = ChannelLimiterManager.load();

const client = new Client({rest, gateway});

client.on(GatewayDispatchEvents.Ready, ({data: {user}}) => {
  console.log('ready as', user.username);
  cm.start();
});

client.on(GatewayDispatchEvents.GuildCreate, ({data: guild}) => {
  const watchingChannels = guild.channels.filter(c => cm.has(c.id));
  for (const c of watchingChannels) {
    assert(c.type === ChannelType.GuildText);
    cm.get(c.id)!.setCurrentSlowmode(c.rate_limit_per_user || 0);
  }
});

client.on(GatewayDispatchEvents.ChannelUpdate, async ({data: channel}) => {
  if (!cm.has(channel.id)) {
    return;
  }

  assert(channel.type === ChannelType.GuildText);

  const cl = cm.get(channel.id)!;
  cl.setCurrentSlowmode(channel.rate_limit_per_user || 0);
});

client.on(GatewayDispatchEvents.MessageCreate, ({data: msg}) => {
  if (!cm.has(msg.channel_id)) {
    return;
  }

  const cl = cm.get(msg.channel_id)!;
  cl.addMessage(msg);
});

gateway.connect();

// TODO: ignore people with manage messages?
