import assert from 'node:assert';

export type Tunings = {
  /** proportional gain */
  kp: number;
  /** integral gain */
  ki: number;
  /** derivative gain */
  kd: number;
};

/** PID Controller based on the code from http://brettbeauregard.com/blog/2011/04/improving-the-beginners-pid-introduction/ */
export class PIDController {
  iTerm = 0;
  lastErr = 0;
  lastTime = 0;
  lastOutput = 0; // TODO: is it okay to call this 0 by default?
  lastInput = 0;

  active = true;

  /** setpoint. the target value */
  sp: number;
  /** proportional gain */
  kp: number;
  /** integral gain */
  ki: number;
  /** derivative gain */
  kd: number;
  /** the time between each sample */
  dt: number;

  min?: number;
  max?: number;

  constructor({
    sp,
    kp,
    ki,
    kd,
    dt,
    min,
    max,
  }: Tunings & {sp: number; dt: number; min?: number; max?: number}) {
    this.sp = sp;
    this.kp = kp;
    this.ki = ki * dt;
    this.kd = kd / dt;
    this.dt = dt;

    this.min = min;
    this.max = max;
  }

  setTunings({kp, ki, kd}: Tunings) {
    this.kp = kp;
    this.ki = ki * this.dt;
    this.kd = kd / this.dt;
    return this;
  }

  /**
   * @param pv process variable. the measured input
   */
  update(pv: number): number {
    if (!this.active) {
      return this.lastOutput;
    }

    const {kp, ki, kd, sp} = this;

    const now = Date.now();

    const dt = now - this.lastTime;
    if (dt >= this.dt) {
      const error = sp - pv;

      const dInput = pv - this.lastInput;

      if (ki) {
        const maybeI = this.iTerm + ki * error;

        const out = this.#clamp(kp * error + maybeI - dInput);

        if (this.min !== undefined && out <= this.min && error > 0) {
          this.iTerm = Math.max(this.iTerm, this.min);
        } else if (this.max !== undefined && out >= this.max && error < 0) {
          this.iTerm = Math.min(this.iTerm, this.max);
        } else {
          this.iTerm = maybeI;
        }
      }

      this.iTerm = this.#clamp(this.iTerm);

      this.lastOutput = kp * error + this.iTerm - kd * dInput;
      this.lastOutput = this.#clamp(this.lastOutput);

      console.log({
        error,
        p: kp * error,
        i: dInput,
        d: this.iTerm,
        output: this.lastOutput,
      });

      this.lastInput = pv;
      this.lastTime = now;
      return this.lastOutput;
    }

    assert(this.lastOutput);
    return this.lastOutput;
  }

  setOutputLimits(min?: number, max?: number) {
    this.min = min;
    this.max = max;

    this.lastOutput = this.#clamp(this.lastOutput);
    this.iTerm = this.#clamp(this.iTerm);
  }

  setActive(active: boolean) {
    if (active && !this.active) {
      // lastInput = input; // ?
      this.iTerm = this.lastOutput;
      this.iTerm = this.#clamp(this.iTerm);
    }

    this.active = active;
  }

  #clamp(val: number) {
    if (this.max !== undefined && val > this.max) {
      return this.max;
    }

    if (this.min !== undefined && val < this.min) {
      return this.min;
    }

    return val;
  }
}
