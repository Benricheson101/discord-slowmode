# Discord Dynamic Slowmode

Dynamic slowmode for Discord channels using a [PID Controller](https://en.wikipedia.org/wiki/Proportional%E2%80%93integral%E2%80%93derivative_controller).

## Config
`./slowmode.json`
```json
{
  "dt": 60,
  "channels": {
    "123123123123": {
      "sp": 5,
      "kp": -1,
      "ki": -0.3,
      "kd": -0.5,
      "min": 0,
      "max": 21600
    }
  }
}
```

`kp`, `ki`, `kd` must be tuned to your server. these are just sample values.
