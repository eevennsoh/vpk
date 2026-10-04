#!/usr/bin/env python3
"""
Composes the Team '26 EU closing-keynote finale cue (9 s, 120 BPM, E major).

Original score, inspired by the Atlassian theme (public/sound/brand/atlassian-theme.wav):
same key (E major), tempo and "build → breath → drop → stab" arc, written to the
finale's picture cues in components/projects/jira-team-eu26-end/finale/data/finale-cues.ts.

Usage:
    python3 scripts/compose-team-eu26-finale-score.py [out.wav]
    python3 scripts/compose-team-eu26-finale-score.py --report   # per-stem section levels
    ffmpeg -y -i out.wav -c:a libmp3lame -b:a 256k public/sound/brand/team-eu26-finale.mp3

Only numpy is required. Output is deterministic (seeded noise).
"""

import sys
import wave

import numpy as np

SR = 48000
BEAT = 0.5
S16 = BEAT / 4
LENGTH = 9.0
RNG = np.random.default_rng(26)

# Picture cues (seconds) — keep in sync with finale-cues.ts.
HIT = 0.0
BELLS = [0.625, 1.125, 1.25, 1.75, 2.0]
TICKS = [0.75, 0.875, 1.0, 1.375, 1.5, 1.625, 1.875, 2.125, 2.25]
DROP = 2.5
STAB = 6.5


def midi(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def timeline():
    return np.zeros((2, int(SR * LENGTH)))


def t_axis(duration):
    return np.arange(int(SR * duration)) / SR


def place(bus, signal, start, gain=1.0, pan=0.0):
    """Adds a mono or stereo signal to the bus at `start` with equal-power pan."""
    if signal.ndim == 1:
        left = np.cos((pan + 1) * np.pi / 4)
        right = np.sin((pan + 1) * np.pi / 4)
        signal = np.stack([signal * left, signal * right])
    begin = int(start * SR)
    if begin >= bus.shape[1]:
        return
    end = min(bus.shape[1], begin + signal.shape[1])
    bus[:, begin:end] += signal[:, : end - begin] * gain


def env(duration, attack=0.002, decay=0.3, sustain=0.0, release=0.05, hold=None):
    """ADSR with exponential decay; `hold` is the gate length before release."""
    t = t_axis(duration)
    hold = duration - release if hold is None else hold
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = sustain + (1 - sustain) * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))
    shape = np.where(t < attack, a, d)
    rel = np.clip(1 - (t - hold) / max(release, 1e-4), 0, 1)
    return shape * np.where(t > hold, rel, 1)


def fft_filter(signal, low=None, high=None, slope=1.0):
    """Zero-phase spectral band shaping (smooth, static)."""
    n = signal.shape[-1]
    spectrum = np.fft.rfft(signal, axis=-1)
    freqs = np.fft.rfftfreq(n, 1 / SR) + 1e-6
    gain = np.ones_like(freqs)
    if high is not None:
        gain *= 1 / (1 + (freqs / high) ** (4 * slope))
    if low is not None:
        gain *= 1 / (1 + (low / freqs) ** (4 * slope))
    return np.fft.irfft(spectrum * gain, n=n, axis=-1)


def sweep_filter(signal, centres, bandwidth=0.9):
    """Block-wise band-pass whose centre follows `centres` (Hz per sample)."""
    block, hop = 2048, 512
    out = np.zeros(len(signal) + block)
    window = np.hanning(block)
    freqs = np.fft.rfftfreq(block, 1 / SR) + 1e-6
    padded = np.concatenate([signal, np.zeros(block)])
    for start in range(0, len(signal), hop):
        centre = centres[min(start + block // 2, len(centres) - 1)]
        octave = np.log2(freqs / centre)
        gain = np.exp(-(octave / bandwidth) ** 2)
        chunk = np.fft.irfft(np.fft.rfft(padded[start:start + block] * window) * gain, n=block)
        out[start:start + block] += chunk * window
    return out[: len(signal)] / 1.5


def saw(freq, duration, harmonics=48, detune_cents=0.0, phase=0.0):
    t = t_axis(duration)
    f = freq * 2 ** (detune_cents / 1200)
    limit = min(harmonics, int((SR / 2) / f))
    out = np.zeros_like(t)
    for k in range(1, limit + 1):
        out += np.sin(2 * np.pi * k * f * t + phase * k) / k
    return out * 0.6


def supersaw(notes, duration, voices=5, spread=18.0):
    """Stereo detuned saw stack for stabs and pads."""
    left = np.zeros(int(SR * duration))
    right = np.zeros_like(left)
    for note in notes:
        for voice in range(voices):
            cents = (voice - (voices - 1) / 2) * spread / ((voices - 1) / 2)
            wave_ = saw(midi(note), duration, harmonics=36, detune_cents=cents, phase=RNG.uniform(0, 6.28))
            pan = (voice / (voices - 1)) * 2 - 1
            left += wave_ * np.cos((pan + 1) * np.pi / 4)
            right += wave_ * np.sin((pan + 1) * np.pi / 4)
    scale = 1 / (len(notes) * voices) ** 0.5
    return np.stack([left, right]) * scale


def fm_bell(freq, duration, ratio=3.5, index=2.4, decay=0.9):
    t = t_axis(duration)
    mod_env = np.exp(-t / 0.12)
    modulator = np.sin(2 * np.pi * freq * ratio * t) * index * mod_env
    return np.sin(2 * np.pi * freq * t + modulator) * np.exp(-t / decay)


def pluck(freq, duration=0.35, brightness=5000):
    tone = saw(freq, duration, harmonics=24) + 0.5 * np.sin(2 * np.pi * freq * 2 * t_axis(duration))
    return fft_filter(tone, high=brightness) * env(duration, attack=0.001, decay=0.12, release=0.05)


def kick(duration=0.6, punch=1.0):
    t = t_axis(duration)
    pitch = 44 + 110 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    body = np.sin(phase) * np.exp(-t / (0.22 * punch))
    click = fft_filter(RNG.standard_normal(len(t)), low=1500) * np.exp(-t / 0.004) * 0.25
    return np.tanh((body + click) * 1.6)


def sub(freq, duration, decay=1.2):
    t = t_axis(duration)
    return np.sin(2 * np.pi * freq * t) * env(duration, attack=0.004, decay=decay, release=0.3)


def noise_hit(duration, low, high, decay):
    t = t_axis(duration)
    return fft_filter(RNG.standard_normal(len(t)), low=low, high=high) * np.exp(-t / decay)


def clap():
    out = np.zeros(int(SR * 0.4))
    for offset in (0.0, 0.011, 0.023):
        burst = noise_hit(0.4 - offset, 900, 5000, 0.012 if offset < 0.02 else 0.12)
        start = int(offset * SR)
        out[start:] += burst[: len(out) - start]
    return out * 0.6


def tick():
    t = t_axis(0.06)
    blip = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.008)
    return blip + noise_hit(0.06, 3000, 12000, 0.004) * 0.4


def reverb(signal, seconds=2.2, damp=6000):
    n = int(SR * seconds)
    t = t_axis(seconds)
    impulse = RNG.standard_normal((2, n)) * np.exp(-t / (seconds / 5))
    impulse = fft_filter(impulse, high=damp)
    impulse[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    size = signal.shape[1] + n
    wet = np.fft.irfft(np.fft.rfft(signal, n=size) * np.fft.rfft(impulse, n=size), n=size)
    return wet[:, : signal.shape[1]] / np.sqrt(n) * 3


def ping_pong(signal, delay=0.375, feedback=0.42, repeats=5):
    out = signal.copy()
    step = int(delay * SR)
    for index in range(1, repeats + 1):
        shifted = np.zeros_like(signal)
        shifted[:, step * index:] = signal[:, : signal.shape[1] - step * index]
        if index % 2:
            shifted = shifted[::-1]
        out += shifted * feedback ** index
    return out


def sidechain(duration, beats, depth=0.6, release=0.2):
    """Gain curve that ducks on every kick for the modern 'pump'."""
    t = t_axis(duration)
    gain = np.ones_like(t)
    for beat in beats:
        since = t - beat
        mask = since >= 0
        gain[mask] = np.minimum(gain[mask], 1 - depth * np.exp(-since[mask] / release))
    return gain


E_MAJOR_STAB = [52, 56, 59, 64, 68, 71, 76]
CHORDS = [  # (start, notes, bass root)
    (DROP, [52, 56, 59, 64, 68], 40),
    (DROP + 2 * BEAT, [49, 52, 56, 61, 64], 37),
    (DROP + 4 * BEAT, [45, 49, 52, 57, 61], 33),
    (DROP + 6 * BEAT, [47, 51, 54, 59, 63], 35),
]


def build_stems():
    drums, music, send, lead = timeline(), timeline(), timeline(), timeline()

    # Opening hit: the product UI dissolves.
    place(music, supersaw([52, 59, 64, 68, 71], 0.9) * env(0.9, decay=0.16, release=0.2), HIT, 0.34)
    place(send, supersaw([64, 68, 71, 76], 0.6) * env(0.6, decay=0.12, release=0.15), HIT, 0.14)
    place(drums, kick(0.5, punch=0.7), HIT, 0.55)
    place(drums, noise_hit(0.6, 2500, 14000, 0.12), HIT, 0.08, pan=0.2)
    place(music, sub(midi(28), 0.8, decay=0.25), HIT, 0.4)

    # Breath: wood ticks and a bell arpeggio — the orbit bursts on the first bell, "Done." builds on the rest.
    for index, time in enumerate(TICKS):
        place(drums, tick(), time, 0.10 + 0.03 * index / len(TICKS), pan=(-0.35 if index % 2 else 0.35))
    for index, (time, note) in enumerate(zip(BELLS, [71, 76, 80, 83, 88])):
        bell = fm_bell(midi(note), 0.9, decay=0.2 + 0.05 * index)
        place(send, bell, time, 0.16, pan=-0.5 + index * 0.25)
        place(music, bell, time, 0.34, pan=-0.5 + index * 0.25)
        place(drums, tick(), time, 0.18)

    # Riser into the drop, cut 60 ms early for the pre-drop gap.
    rise_len = DROP - 1.25 - 0.0625
    t = t_axis(rise_len)
    centres = 300 * (9000 / 300) ** ((t / rise_len) ** 1.6)
    riser = sweep_filter(RNG.standard_normal(len(t)), centres) * (t / rise_len) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(midi(52) * 2 ** (2 * (t / rise_len) ** 2)) / SR) * (t / rise_len) ** 3
    place(send, riser, 1.25, 0.22)
    place(music, riser * 0.8 + tone * 0.12, 1.25, 0.26)

    # Drop and chorus: kick on every beat, claps on 2 and 4, offbeat hats.
    kicks = [DROP + index * BEAT for index in range(8)]
    for time in kicks:
        place(drums, kick(), time, 0.85)
    place(drums, noise_hit(2.4, 3500, 16000, 0.9), DROP, 0.22, pan=-0.2)
    place(music, sub(midi(28), 1.6, decay=0.7), DROP, 0.42)
    for index in range(1, 8, 2):
        place(drums, clap(), DROP + index * BEAT, 0.42)
        place(send, clap(), DROP + index * BEAT, 0.20)
    for index in range(16):
        time = DROP + index * S16 * 2 + S16 * 2 * 0.5
        if time < STAB - 0.5:
            place(drums, noise_hit(0.08, 7000, 18000, 0.018), time, 0.14, pan=0.3)

    chorus_len = STAB - DROP
    pump = sidechain(chorus_len, [k - DROP for k in kicks])
    for start, notes, root in CHORDS:
        length = 2 * BEAT
        pad = supersaw(notes, length + 0.1) * env(length + 0.1, attack=0.01, decay=0.6, sustain=0.55, release=0.08)
        pad = fft_filter(pad, high=4200)
        offset = int((start - DROP) * SR)
        pad *= pump[offset:offset + pad.shape[1]] if offset + pad.shape[1] <= len(pump) else 1
        place(music, pad, start, 0.30)
        for step in range(8):
            bass = saw(midi(root), 0.2, harmonics=12) * env(0.2, decay=0.09, release=0.04)
            place(music, fft_filter(bass, high=900), start + step * S16 * 2 + S16 * 2 * 0.5, 0.34)
        arpeggio = [notes[2] + 12, notes[3] + 12, notes[4] + 12, notes[3] + 12]
        for step in range(8):
            place(lead, pluck(midi(arpeggio[step % 4])), start + step * S16 * 2, 0.16, pan=0.25 * np.sin(step))

    # Snare roll into the stab, with a one-16th gap before it lands.
    for index in range(7):
        time = STAB - BEAT + index * (S16 * 0.5 if index > 3 else S16)
        if time < STAB - S16 * 0.5:
            place(drums, noise_hit(0.12, 700, 7000, 0.05) + 0.3 * np.sin(2 * np.pi * 190 * t_axis(0.12)) * np.exp(-t_axis(0.12) / 0.04), time, 0.12 + 0.05 * index)

    # Final stab: everything is Done.
    tail = LENGTH - STAB
    place(drums, kick(0.9, punch=1.3), STAB, 0.95)
    place(drums, noise_hit(tail, 3000, 16000, 1.1), STAB, 0.25, pan=0.15)
    place(music, sub(midi(28), tail, decay=1.3), STAB, 0.45)
    stab = supersaw(E_MAJOR_STAB, tail) * env(tail, attack=0.004, decay=0.9, sustain=0.18, release=1.2)
    place(music, fft_filter(stab, high=6500), STAB, 0.42)
    place(send, stab, STAB, 0.30)
    place(send, fm_bell(midi(88), 2.4), STAB, 0.20)
    place(music, fm_bell(midi(95), 2.4), STAB + S16, 0.07, pan=0.4)

    lead = ping_pong(lead)
    wet = reverb(send + lead * 0.4 + music * 0.08) * 0.5
    # Choke the bells and reverb return in the pre-drop gap so the silence is real.
    gap = np.ones(wet.shape[1])
    gap_start, gap_end = int((DROP - 0.0625) * SR), int(DROP * SR)
    gap[gap_start - int(0.02 * SR):gap_start] = np.linspace(1, 0, int(0.02 * SR))
    gap[gap_start:gap_end] = 0
    return {"drums": drums, "music": music * gap, "lead": lead * 0.9, "wet": wet * gap}


def master(stems):
    mix = sum(stems.values())
    mix = fft_filter(mix, low=28)
    fade = np.ones(mix.shape[1])
    fade_start = int(8.2 * SR)
    fade[fade_start:] = np.linspace(1, 0, mix.shape[1] - fade_start) ** 1.5
    mix *= fade
    # Gentle bus saturation, then peak-normalise with headroom for MP3 intersample overs.
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.4
    mix = np.tanh(mix) / np.tanh(1.4)
    return mix * 0.84


def compose():
    return master(build_stems())


def report(stems):
    """Per-stem RMS (dB, pre-master) in each section, for mix balancing."""
    sections = [("hit", 0, 0.5), ("breath", 0.5, 1.25), ("riser", 1.25, 2.44), ("gap", 2.44, 2.5), ("chorus", 2.5, 6.5), ("stab", 6.5, 8.0)]
    for name, stem in stems.items():
        cells = []
        for label, start, end in sections:
            chunk = stem[:, int(start * SR):int(end * SR)]
            cells.append(f"{label} {20 * np.log10(np.sqrt((chunk ** 2).mean()) + 1e-9):6.1f}")
        print(f"{name:6s} " + " | ".join(cells))


def write_wav(path, stereo):
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2").T.copy()
    with wave.open(path, "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())


if __name__ == "__main__":
    if "--report" in sys.argv:
        report(build_stems())
        sys.exit(0)
    target = sys.argv[1] if len(sys.argv) > 1 else "team-eu26-finale.wav"
    write_wav(target, compose())
    print(f"wrote {target} ({LENGTH:.2f}s @ {SR} Hz)")
