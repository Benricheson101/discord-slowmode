import {readFileSync} from 'node:fs';
import {API, type APITextChannel} from '@discordjs/core';
import {REST} from '@discordjs/rest';
import {ChannelLimiter} from './limiter';

type SlowmodeConfig = {
  dt: number;
  channels: {
    [id: string]: Omit<ConstructorParameters<typeof ChannelLimiter>[0], 'dt'>;
  };
};

export class ChannelLimiterManager extends Map<string, ChannelLimiter> {
  #timer?: NodeJS.Timeout;

  constructor(
    private api: API,
    readonly dt: number
  ) {
    super();
  }

  new(
    channelID: string,
    arg: Omit<ConstructorParameters<typeof ChannelLimiter>[0], 'dt'>
  ) {
    const cl = new ChannelLimiter({...arg, sp: arg.sp / 60, dt: this.dt});
    this.set(channelID, cl);
  }

  #doUpdate(channelID: string, cl: ChannelLimiter) {
    const newSlowmode = cl.controlLoop();
    cl.cleanup();

    if (newSlowmode === cl.currentSlowmode) {
      return;
    }

    this.api.channels
      .edit(channelID, {rate_limit_per_user: newSlowmode})
      .then(res => {
        console.log(
          'set new channel slowmode to:',
          (res as APITextChannel).rate_limit_per_user || 0
        );
      })
      .catch(err => {
        console.error('failed to set channel slowmode to:', newSlowmode, err);
      });
  }

  start() {
    console.log(`[ChannelLimiterManager] started. channels=${this.size} dt=${this.dt}`);
    this.#timer = setInterval(() => {
      for (const entry of this.entries()) {
        // skip channels that haven't had any activity at all
        if (!entry[1].hasStarted) {
          continue;
        }

        this.#doUpdate(...entry);
      }
    }, this.dt * 1_000);
  }

  stop() {
    if (!this.#timer) {
      return;
    }

    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  static load(file = './slowmode.json', token = process.env.DISCORD_TOKEN!) {
    const cfg = readFileSync(file, 'utf8');
    const conf = JSON.parse(cfg) as SlowmodeConfig;

    const rest = new REST().setToken(token);
    const api = new API(rest);

    const mgr = new ChannelLimiterManager(api, conf.dt);

    for (const channel in conf.channels) {
      mgr.new(channel, conf.channels[channel]);
    }

    console.log('loaded slowmode configs for', mgr.size, 'channels');

    return mgr;
  }
}
