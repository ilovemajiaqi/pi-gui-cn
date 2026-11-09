# beat_analysis.py — BGM 节拍网格测定 + 鼓点三分类 + RMS 结构表（music-beat-sync §1–3）
# 产物: analysis/beat_data.json + grid_drift.json（浮点秒，不预取整）
import json, os, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt

BGM = os.environ.get("BGM_PATH", "../assets_src/bgm.mp3")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))

y, sr = librosa.load(BGM, sr=None, mono=True)
dur = librosa.get_duration(y=y, sr=sr)
print(f"duration={dur:.2f}s sr={sr}")

tempo, beats = librosa.beat.beat_track(y=y, sr=sr, tightness=400, units="time")
beats = np.asarray(beats, dtype=float)

def grid_fit(seq):
    i = np.arange(len(seq))
    A = np.vstack([i, np.ones_like(i)]).T
    (T, t0), *_ = np.linalg.lstsq(A, seq, rcond=None)
    resid = seq - (t0 + i * T)
    return float(T), float(t0), float(np.abs(resid).max())

T, t0, resid = grid_fit(beats)
bpm = 60.0 / T
print(f"beat_track tempo={float(np.atleast_1d(tempo)[0]):.2f} -> fit BPM={bpm:.2f} t0={t0:.4f} T={T:.5f} 残差±{resid*1000:.1f}ms")

# 半倍/双倍歧义：三个候选都算指标
def band_env(y, sr, lo, hi):
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    env = librosa.onset.onset_strength(y=sosfilt(sos, y), sr=sr)
    return env, librosa.times_like(env, sr=sr)

perc = librosa.effects.hpss(y)[1]
k_env, k_t = band_env(perc, sr, 40, 160)
sn_env, sn_t = band_env(y, sr, 150, 500)
hh_env, hh_t = band_env(perc, sr, 6000, 14000)
on_env, on_t = librosa.onset.onset_strength(y=perc, sr=sr), librosa.times_like(librosa.onset.onset_strength(y=perc, sr=sr), sr=sr)
on_times = on_t

def grid_metrics(Tc, t0c, span_end):
    n = int((span_end - t0c) / Tc) - 1
    grid = t0c + np.arange(n) * Tc
    # 每个网格拍命中最接近瞬态（<60ms 记命中）
    idx = np.searchsorted(on_times, grid)
    idx = np.clip(idx, 1, len(on_times) - 1)
    left, right = on_times[idx - 1], on_times[idx]
    nearest_err = np.where(np.abs(grid - left) < np.abs(grid - right), grid - left, grid - right)
    hit = np.abs(nearest_err) < 0.06
    match = float(hit.mean())
    mean_abs = float(np.abs(nearest_err[hit]).mean()) if hit.any() else 999.0
    # 漂移：命中误差对拍号线性回归斜率
    if hit.sum() > 10:
        k = np.arange(n)[hit]
        slope = float(np.polyfit(k, nearest_err[hit], 1)[0])
    else:
        slope = 999.0
    return {"match": match, "mean_abs_ms": mean_abs * 1000, "drift_total_ms": slope * n * 1000}

span_end = dur - 1.0
candidates = {}
for label, Tf, t0f in [("0.5x", T * 2, t0), ("1x", T, t0), ("2x", T / 2, t0)]:
    candidates[label] = grid_metrics(Tf, t0f, span_end)
    candidates[label]["t0"] = t0f
    candidates[label]["T"] = Tf
print(json.dumps(candidates, indent=1))

best_label = max(candidates, key=lambda k: candidates[k]["match"] - candidates[k]["mean_abs_ms"] / 1000)
Tc, t0c = candidates[best_label]["T"], candidates[best_label]["t0"]
print(f"WINNER={best_label} BPM={60/Tc:.2f}")

# 网格拍上的三类能量 → hits 表（只存能量，帧选在下游）
n_total = int((dur - t0c) / Tc) - 1
hits = []
rms = librosa.feature.rms(y=y, frame_length=2048)[0]
rms_t = librosa.times_like(rms, sr=sr)
for n in range(n_total):
    t = t0c + n * Tc
    e = lambda env, tt: float(env[np.argmin(np.abs(tt - t))])
    k_n = e(k_env, k_t); s_n = e(sn_env, sn_t); h_n = e(hh_env, hh_t)
    r = float(rms[np.argmin(np.abs(rms_t - t))])
    kcat = "kick" if k_n > s_n else "snare"
    hits.append({ "n": n, "t": round(t, 5), "kick": round(k_n, 4), "snare": round(s_n, 4), "hihat": round(h_n, 4), "rms": round(r, 5) })

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "beat_data.json"), "w", encoding="utf8") as f:
    json.dump({ "bpm": 60/Tc, "t0": t0c, "T": Tc, "duration": dur,
        "candidates": candidates, "winner": best_label,
        "beats": [round(t0c + n * Tc, 5) for n in range(n_total)],
        "hits": hits }, f, ensure_ascii=False)
print(f"saved beat_data.json ({n_total} beats)")
