import type {API, APIMessage, APITextChannel} from '@discordjs/core';
import {PIDController} from './pidcontroller';

export class ChannelLimiter extends PIDController {
  msgs = 0;
  users = new Set<string>();
  #timer?: NodeJS.Timeout;
  private api: API;
  readonly channelID: string;

  currentSlowmode = 0;

  constructor({
    api,
    channelID,
    pid,
  }: {
    api: API;
    channelID: string;
    pid: ConstructorParameters<typeof PIDController>[0];
  }) {
    super(pid);
    this.api = api;
    this.channelID = channelID;
  }

  controlLoop() {
    let actualRate = this.msgs / this.users.size / this.dt;
    if (Number.isNaN(actualRate)) {
      actualRate = 0;
    }

    console.log(
      `=> chat rate: ${actualRate} messages per second (${actualRate * 60} messages per minute)`
    );
    const adj = this.update(actualRate);

    const newSlowmode = adj;
    console.log({
      currentSlowmode: this.currentSlowmode,
      msgs: this.msgs,
      users: this.users.size,
      dt: this.dt,
      currentRate: actualRate,
      targetRate: this.sp,
      u: newSlowmode,
    });

    return Math.round(newSlowmode);
  }

  setCurrentSlowmode(c: number) {
    this.currentSlowmode = c;
    return this;
  }

  addMessage(msg: APIMessage) {
    const author = msg.author.id;
    this.msgs++;
    this.users.add(author);

    return this;
  }

  cleanup() {
    this.msgs = 0;
    this.users.clear();
  }

  start() {
    const dt = this.dt;
    console.log(
      `ChannelLimiter<${this.channelID}> started. interval=${dt * 1_000}ms`
    );

    this.#timer = setInterval(() => {
      const newSlowmode = this.controlLoop();

      if (newSlowmode === this.currentSlowmode) {
        this.cleanup();
        return;
      }

      this.cleanup();

      this.api.channels
        .edit(this.channelID, {rate_limit_per_user: newSlowmode})
        .then(res => {
          console.log(
            'Set new channel slowmode to:',
            (res as APITextChannel).rate_limit_per_user || 0
          );
        })
        .catch(err => {
          console.error('Failed to set channel slowmode to:', newSlowmode, err);
        })
        .finally(() => {
          this.cleanup();
        });
    }, dt * 1_000);
  }

  stop() {
    if (!this.#timer) {
      return;
    }
    clearInterval(this.#timer);
    this.#timer = undefined;
  }
}

// TODO: don't use individual intervals for every channel, use one interval to trigger all of them
