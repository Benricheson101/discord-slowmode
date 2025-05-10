import type {API, APIMessage, APITextChannel} from '@discordjs/core';
import {PIDController} from './pidcontroller';

export class ChannelLimiter extends PIDController {
  msgs = 0;
  users = new Set<string>();

  currentSlowmode = 0;

  hasStarted = false;

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
    this.hasStarted = true;

    const author = msg.author.id;
    this.msgs++;
    this.users.add(author);

    return this;
  }

  cleanup() {
    this.msgs = 0;
    this.users.clear();
  }
}

// TODO: don't use individual intervals for every channel, use one interval to trigger all of them
