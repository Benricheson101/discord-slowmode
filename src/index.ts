import assert from 'node:assert';
import {
  type API,
  ChannelType,
  Client,
  GatewayDispatchEvents,
  GatewayIntentBits,
} from '@discordjs/core';
import {REST} from '@discordjs/rest';
import {WebSocketManager} from '@discordjs/ws';
import {ChannelLimiter} from './limiter';

const token = process.env.DISCORD_TOKEN!;

const CHANNELS = new Set([
  '1370499489399574538', // spam
  '1362546419860242673', // yap
]);

const DT = 30;

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages,
  rest,
  token,
});

const limiters = new Map<string, ChannelLimiter>();
const getLimiter = (c: string, api: API) => {
  let cl = limiters.get(c);
  if (!cl) {
    cl = new ChannelLimiter({
      api,
      channelID: c,
      pid: {
        sp: 3 / 60,
        dt: DT,
        kp: -1.5,
        ki: -0.3,
        kd: -0.5,
        min: 0,
        max: 60 * 60 * 6,
      },
    });
    limiters.set(c, cl);
  }

  return cl;
};

const client = new Client({rest, gateway});

client.on(GatewayDispatchEvents.Ready, ({data: {user}}) => {
  console.log('ready as', user.username);
});

client.on(GatewayDispatchEvents.GuildCreate, ({data: guild, api}) => {
  if (!CHANNELS.size) {
    return;
  }

  const chs = guild.channels.filter(c => CHANNELS.has(c.id));
  if (!chs.length) {
    return;
  }

  for (const ch of chs) {
    CHANNELS.delete(ch.id);
    const cl = getLimiter(ch.id, api);

    assert(ch.type === ChannelType.GuildText);
    const current = ch.rate_limit_per_user || 0;
    cl.setCurrentSlowmode(current);
    cl.iTerm = current; // TODO: is this right?

    cl.start();
  }
});

client.on(GatewayDispatchEvents.ChannelUpdate, async ({data: channel, api}) => {
  if (!limiters.has(channel.id)) {
    return;
  }

  assert(channel.type === ChannelType.GuildText);

  const cl = getLimiter(channel.id, api);
  cl.setCurrentSlowmode(channel.rate_limit_per_user || 0);
});

client.on(GatewayDispatchEvents.MessageCreate, ({data: msg, api}) => {
  if (!limiters.has(msg.channel_id)) {
    return;
  }

  const cl = getLimiter(msg.channel_id, api);
  cl.addMessage(msg);
});

gateway.connect();

// TODO: ignore people with manage messages?
