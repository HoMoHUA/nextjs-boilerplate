export function motionIdentitySeed(identity: string): number {
  let hash = 2166136261;
  for (const char of identity) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
function noise(seed: number, cycle: number): number {
  let n = Math.imul(seed ^ cycle, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function motionProfile(seed: number) {
  return { seed, phase: noise(seed, 1) * 19, breathRate: 1.3 + noise(seed, 2) * .65, gaitRate: 8 + noise(seed, 3) * 1.3, gazePeriod: 13 + noise(seed, 4) * 9 };
}
export function dampFactor(rate: number, delta: number) { return 1 - Math.exp(-rate * Math.max(0, Math.min(.05, delta))); }
export function relativeGazeYaw(targetYaw: number, bodyYaw: number) {
  const angle = Math.atan2(Math.sin(targetYaw-bodyYaw), Math.cos(targetYaw-bodyYaw));
  return Math.max(-.45, Math.min(.45, angle));
}
export function sampleMotion(profile: ReturnType<typeof motionProfile>, time: number, working: boolean, reduced: boolean) {
  if (reduced) return { breath: 0, blink: 1, gaze: 0, typing: 0, gesture: 0, posture: 0 };
  const t = time + profile.phase;
  const cycle = Math.floor(t / 8);
  const within = t % 8;
  const blinkAt = .8 + noise(profile.seed, cycle + 30) * 5.8;
  const blink = 1 - .92 * Math.max(0, 1 - Math.abs(within - blinkAt) / .12);
  const attention = t / profile.gazePeriod;
  const gazePosition = attention % 1;
  const gaze = gazePosition > .68 && gazePosition < .84 ? Math.sin((gazePosition - .68) / .16 * Math.PI) ** 2 : 0;
  const typingCycle = Math.floor(t / 9);
  const pause = 4.2 + noise(profile.seed, typingCycle + 200) * 2.7;
  const typing = working && t % 9 < pause ? .55 + noise(profile.seed, typingCycle + 500) * .45 : 0;
  const request = (t / (21 + noise(profile.seed, 7)*8)) % 1;
  return {
    breath: .006 * Math.sin(t * profile.breathRate) + .0015 * Math.sin(t * .41), blink, gaze, typing,
    gesture: request < .08 ? Math.sin(request/.08*Math.PI)**2 : 0,
    posture: Math.sin(t * .23) * .015,
  };
}
