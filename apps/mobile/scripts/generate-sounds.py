#!/usr/bin/env python3
"""Makes the app's sound effects, apps/mobile/assets/sounds/*.wav, from scratch.

Every sound is synthesized here, so we own them outright (no licenses to track)
and can retune one by editing a few numbers and running:

    python3 apps/mobile/scripts/generate-sounds.py

Standard library only, and deterministic: the same script always writes the same
bytes. The sound names match src/design/sounds.ts.

The style is short, poppy and clean: sine pops and plucks in one bright key
(C major pentatonic), quick attacks, no noise or buzz, nothing much over a
second, and nothing that sounds like a "wrong" buzzer. No music.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'sounds'
# The highest notes the sparkles pick from; all in C major pentatonic.
SPARKLE_NOTES = ('C7', 'D7', 'E7', 'G7', 'A7', 'C8')
_SEMITONES = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def hz(name):
    """'C6' -> 1046.5. Sharps as 'C#6'."""
    return 440 * 2 ** ((_SEMITONES[name[0]] + ('#' in name) + 12 * (int(name[-1]) - 4)) / 12)


def tone(length, freq, to=None, glide=0.0, attack=0.002, decay=0.1, partials=((1, 1.0),)):
    """A sine voice. `to`/`glide`: slide from freq to `to` over `glide` seconds.
    Partials are (multiple, level); each dies away `multiple` times faster, which makes a pluck."""
    samples = [0.0] * int(length * RATE)
    phases = [0.0] * len(partials)
    for i in range(len(samples)):
        t = i / RATE
        f = freq * (to / freq) ** min(1.0, t / glide) if to and glide > 0 else freq
        value = 0.0
        for k, (multiple, level) in enumerate(partials):
            phases[k] += 2 * math.pi * f * multiple / RATE
            value += level * math.sin(phases[k]) * math.exp(-t * multiple / decay)
        samples[i] = value * min(1.0, t / attack)
    return samples


def pop(low, high, length=0.11, decay=0.035):
    """A bubble pop: a quick upward slide."""
    return tone(length, low, high, glide=0.03, attack=0.0015, decay=decay, partials=((1, 1.0), (2, 0.12)))


def pluck(note, decay=0.12, length=None):
    """A clean, glassy note with a crisp start."""
    f = hz(note)
    body = tone(length or decay * 4, f, decay=decay, attack=0.0015, partials=((1, 1.0), (2, 0.35), (3, 0.08)))
    return mix(body, tone(0.01, f * 4, decay=0.003, attack=0.0005), 0, 0.15)


def mix(into, sound, at, gain=1.0):
    """Adds `sound` into `into` starting at `at` seconds, growing `into` if needed."""
    start = int(at * RATE)
    if len(into) < start + len(sound):
        into.extend([0.0] * (start + len(sound) - len(into)))
    for i, value in enumerate(sound):
        into[start + i] += value * gain
    return into


def sparkles(into, rng, start, end, count, gain=0.22):
    """Tiny high plucks scattered between `start` and `end` seconds."""
    for _ in range(count):
        mix(into, pluck(rng.choice(SPARKLE_NOTES), decay=rng.uniform(0.035, 0.07)), rng.uniform(start, end),
            gain * rng.uniform(0.6, 1.0))
    return into


def arpeggio(into, notes, start, step, decay=0.12, gain=1.0):
    for k, note in enumerate(notes):
        mix(into, pluck(note, decay=decay), start + k * step, gain)
    return into


# ---- The sounds -------------------------------------------------------------
# Each returns (samples, peak). Peak is how loud the sound is (0-1); quieter for
# sounds that play often, so a busy game never gets loud.

def click(rng):
    """Every button press: a tiny, dry 'tock'."""
    out = tone(0.035, 2000, 1300, glide=0.012, attack=0.0008, decay=0.007, partials=((1, 1.0), (2, 0.2)))
    return mix(out, tone(0.035, 1000, attack=0.0008, decay=0.01), 0, 0.5), 0.3


def make_pop(low):
    def sound(rng):
        """Points: a bright bubble pop. Three pitches, so fast scoring doesn't sound like a machine."""
        return pop(low, low * 2.3), 0.5
    return sound


def tap(rng):
    """Feedback 'tap': a softer, lower pop."""
    return pop(420, 900, length=0.09, decay=0.03), 0.4


def tick(rng):
    """Feedback 'tick': a tiny glassy tick, for knob steps."""
    return tone(0.03, hz('E7'), attack=0.0005, decay=0.006, partials=((1, 1.0), (2, 0.25))), 0.26


def nudge(rng):
    """Feedback 'nudge': a soft, round 'boop'. A gentle "try again", never a buzzer."""
    return tone(0.16, 620, 740, glide=0.06, attack=0.008, decay=0.05), 0.24


def success(rng):
    """Feedback 'success': ding-ding, up a fourth."""
    return arpeggio([], ('G6', 'C7'), 0, 0.075, decay=0.11), 0.5


def start(rng):
    """A game begins: two rising pops, 'ready, go'."""
    out = mix([], pop(480, 1100), 0)
    return mix(out, pop(720, 1650), 0.07), 0.45


def milestone(rng):
    """Passing 100, 500, 1000…: a quick rising chime."""
    out = arpeggio([], ('C6', 'E6', 'G6'), 0, 0.06, decay=0.1)
    mix(out, pluck('C7', decay=0.14), 0.18)
    return sparkles(out, rng, 0.22, 0.45, 3), 0.55


def celebrate(rng):
    """A new high score: pop, a run up the scale, and a shower of sparkles."""
    out = mix([], pop(600, 1500), 0, 0.7)
    arpeggio(out, ('C6', 'E6', 'G6', 'C7', 'E7'), 0.04, 0.05, decay=0.13)
    return sparkles(out, rng, 0.3, 0.8, 8), 0.62


def finish(rng):
    """A game ends: a warm two-note 'all done'."""
    out = mix([], pluck('G6', decay=0.12), 0)
    mix(out, pluck('C7', decay=0.16), 0.09)
    return mix(out, pluck('C6', decay=0.16), 0.09, 0.4), 0.5


def level_up(rng):
    """A new level: a swoosh up, a run, and a sparkling chord."""
    out = [value * 0.35 for value in tone(0.3, 400, 1600, glide=0.18, attack=0.01, decay=0.12)]
    arpeggio(out, ('C6', 'E6', 'G6', 'C7'), 0.12, 0.07, decay=0.12)
    for note in ('C7', 'E7', 'G7'):
        mix(out, pluck(note, decay=0.18), 0.42, 0.6)
    return sparkles(out, rng, 0.45, 0.95, 7), 0.62


def badge(rng):
    """A new badge: a twinkle and a glassy ring."""
    out = arpeggio([], ('E7', 'C7', 'G7', 'E7', 'C8'), 0, 0.07, decay=0.09)
    for note in ('C7', 'G7'):
        mix(out, pluck(note, decay=0.16), 0.35, 0.5)
    return out, 0.55


SOUNDS = {
    'click': click,
    'pop1': make_pop(520),
    'pop2': make_pop(600),
    'pop3': make_pop(680),
    'tap': tap,
    'tick': tick,
    'nudge': nudge,
    'success': success,
    'start': start,
    'milestone': milestone,
    'celebrate': celebrate,
    'finish': finish,
    'levelUp': level_up,
    'badge': badge,
}


def finished(samples, peak):
    """Trims the silent tail, scales to `peak` and fades out the last 5 ms so nothing clicks at the end."""
    loudest = max(abs(value) for value in samples) or 1.0
    # Below about -40 dB a tail is inaudible on a phone speaker; cut it so sounds stay snappy.
    last = max(i for i, value in enumerate(samples) if abs(value) >= loudest * 0.01)
    fade = int(0.005 * RATE)
    samples = samples[:last + fade]
    for i in range(1, fade + 1):
        samples[-i] *= i / fade
    return [value * peak / loudest for value in samples]


def write_wav(path, samples):
    with wave.open(str(path), 'wb') as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(b''.join(struct.pack('<h', round(value * 32767)) for value in samples))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        samples, peak = make(random.Random(name))
        final = finished(samples, peak)
        write_wav(OUT / f'{name}.wav', final)
        print(f'{name:10} {len(final) / RATE * 1000:5.0f} ms')


if __name__ == '__main__':
    main()
