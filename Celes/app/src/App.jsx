import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'

function Button({ className = '', variant = 'primary', ...props }) {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2'
  const styles = variant === 'ghost'
    ? 'bg-transparent hover:bg-neutral-800 border border-neutral-800 text-neutral-200'
    : 'bg-primary text-primary-foreground hover:bg-primary/90'
  return <button className={`${base} ${styles} ${className}`} {...props} />
}

function Sidebar({ onSelect }) {
  return (
    <aside className="w-60 border-r border-neutral-800 h-screen sticky top-0 hidden md:flex flex-col">
      <div className="px-4 py-3 text-lg font-semibold">Celes</div>
      <nav className="px-2 py-2 space-y-1">
        {[
          ['home', 'Home'],
          ['search', 'Search'],
          ['library', 'Library'],
        ].map(([key, label]) => (
          <Button key={key} variant="ghost" className="w-full justify-start" onClick={() => onSelect(key)}>{label}</Button>
        ))}
      </nav>
      <div className="mt-auto p-3 text-xs text-neutral-500">Open source alternative to Spotify</div>
    </aside>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('home')
  const platforms = useMemo(() => ['soundcloud', 'internetarchive'], [])
  const [platform] = useState('soundcloud')
  const [queue, setQueue] = useState([])
  const [playlists, setPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('celes.playlists') || '[]') } catch { return [] }
  })
  const [activePlaylistId, setActivePlaylistId] = useState(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    try { const v = Number(localStorage.getItem('celes.volume')); return Number.isFinite(v)? Math.max(0, Math.min(1, v)) : 0.8 } catch { return 0.8 }
  })
  const audioRef = useRef(null)

  // Home: daily mixes / charts
  const [dailyMix, setDailyMix] = useState([])
  const [chartsSC, setChartsSC] = useState([])
  const [chartsYT, setChartsYT] = useState([])
  const [homeLoading, setHomeLoading] = useState(false)
  const [chartsDate, setChartsDate] = useState('')

  async function loadHome() {
    setHomeLoading(true)
    try {
      // Release Radar proxy (uses trending-like queries under the hood)
      const radar = await window.electronAPI.getReleaseRadar?.(24)
      setDailyMix(Array.isArray(radar) ? radar : [])
      // Top charts (Top 50)
      const yt = await window.electronAPI.getTopCharts?.('youtube', 50)
      setChartsYT(yt || [])
      const sc = await window.electronAPI.getTopCharts?.('soundcloud', 50)
      setChartsSC(sc || [])
      setChartsDate(new Date().toLocaleDateString())
    } catch (e) {
      // ignore
    } finally {
      setHomeLoading(false)
    }
  }

  async function doSearch() {
    if (!query.trim()) return
    setLoading(true)
    try {
      // Default to YouTube with fallback to SoundCloud/Internet Archive for better hit rate
      const res = await window.electronAPI.searchMusicWithFallback(query, 'youtube', 24)
      setResults(res || [])
    } finally {
      setLoading(false)
    }
  }

  async function doPlay(track) {
    const audio = audioRef.current
    if (!audio) return
    const toProxy = (u) => `celes-stream://proxy?u=${encodeURIComponent(u)}`
    let src = track?.streamUrl ? toProxy(track.streamUrl) : null
    if (!src) {
      const prefPlat = track.platform || 'internetarchive'
      const result = await window.electronAPI.getStreamUrlWithFallback(track.id, prefPlat).catch(() => null)
      if (result?.streamUrl) src = toProxy(result.streamUrl)
    }
    if (!src) return
    try {
      setCurrentTrack(track)
      audio.src = src
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  function addToQueue(track) {
    setQueue((q) => [...q, track])
  }

  function playNext(track) {
    setQueue((q) => [track, ...q])
  }

  function removeFromQueue(idx) {
    setQueue((q) => q.filter((_, i) => i !== idx))
  }

  function savePlaylists(next) {
    setPlaylists(next)
    try { localStorage.setItem('celes.playlists', JSON.stringify(next)) } catch {}
  }

  function createPlaylist(name) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    savePlaylists([ ...playlists, { id, name, tracks: [], cover: null } ])
    setActivePlaylistId(id)
  }

  function renamePlaylist(playlistId, newName) {
    const next = playlists.map(p => p.id === playlistId ? { ...p, name: newName } : p)
    savePlaylists(next)
  }

  function setPlaylistCover(playlistId, dataUrl) {
    const next = playlists.map(p => p.id === playlistId ? { ...p, cover: dataUrl } : p)
    savePlaylists(next)
  }

  function addTrackToPlaylist(playlistId, track) {
    const next = playlists.map(p => p.id === playlistId ? { ...p, tracks: [...p.tracks, track] } : p)
    savePlaylists(next)
  }

  function removeTrackFromPlaylist(playlistId, index) {
    const next = playlists.map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter((_, i) => i !== index) } : p)
    savePlaylists(next)
  }

  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || null

  function nextFromQueue() {
    setQueue((q) => {
      if (q.length === 0) { setIsPlaying(false); return q }
      const [next, ...rest] = q
      // fire and forget; state update will happen inside doPlay
      void doPlay(next)
      return rest
    })
  }

  function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play().then(() => setIsPlaying(true)).catch(() => {}) } else { audio.pause(); setIsPlaying(false) }
  }

  function fmtTime(s) {
    if (!Number.isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  async function persistTrack(track) {
    try {
      // If it's a stream, store minimal metadata in DB via addStreamingTrack
      if (track && track.type === 'stream') {
        const payload = {
          title: track.title,
          artist: track.artist,
          album: track.album || (track.platform === 'youtube' ? 'YouTube Music' : 'Streaming'),
          duration: track.duration || 0,
          platform: track.platform,
          stream_id: String(track.id),
          stream_url: track.streamUrl || track.url || null,
          thumbnail_url: track.thumbnail || null,
        }
        const res = await window.electronAPI.addStreamingTrack?.(payload)
        return res?.songId || null
      }
      return null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (view === 'home') loadHome()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    const onTime = () => setProgress(audio.currentTime || 0)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => nextFromQueue()
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [audioRef.current])

  useEffect(() => { try { localStorage.setItem('celes.volume', String(volume)) } catch {} ; if (audioRef.current) audioRef.current.volume = volume }, [volume])

  useEffect(() => { window.electronAPI.streamingHealthCheck?.() }, [])

  const SectionCard = ({ title, items }) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {(items || []).map((t) => (
          <div key={t.id} className="bg-neutral-900/60 border border-neutral-800 rounded p-3 flex flex-col gap-2">
            <img alt={t.title} src={t.thumbnail || 'https://via.placeholder.com/300x200/4a9eff/ffffff?text=♫'} className="w-full h-36 object-cover rounded" />
            <div className="text-sm font-medium line-clamp-2">{t.title}</div>
            <div className="text-xs text-neutral-400">{t.artist} • {t.platform}</div>
            <div className="flex gap-2">
              <Button className="mt-1 flex-1" onClick={() => doPlay(t)}>Play</Button>
              <Button className="mt-1" variant="ghost" onClick={() => addToQueue(t)}>+ Queue</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      <Sidebar onSelect={setView} />
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-neutral-800 flex items-center px-4 gap-3">
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 flex-1 max-w-3xl">
            <input
              className="bg-transparent outline-none text-sm w-full"
              placeholder="Ask for any song, artist, mood…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
            />
            <Button onClick={doSearch} disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
          </div>
          <div className="md:hidden flex-1" />
        </header>

        {/* Content */}
        <main className="flex-1 grid lg:grid-cols-[1fr_320px_340px] md:grid-cols-[1fr_320px] gap-4 p-4 pb-28">
          {/* Left content */}
          <section className="space-y-3">
            {view === 'home' && (
              <>
                {homeLoading && <div className="text-sm text-neutral-400">Loading mixes…</div>}
                {!homeLoading && (
                  <>
                    <SectionCard title={`Daily Mix • ${chartsDate}`} items={dailyMix} />
                    <SectionCard title={`YouTube Top 50 • ${chartsDate}`} items={chartsYT} />
                    <SectionCard title={`SoundCloud Top 50 • ${chartsDate}`} items={chartsSC} />
                  </>
                )}
              </>
            )}
            {view === 'search' && (
              <>
                {!results.length && (
                  <div className="text-sm text-neutral-400">
                    Type anything – e.g. “calming piano at night”, “vocal jazz 50s”, “beethoven sonata 14”.
                  </div>
                )}
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {results.map((t) => (
                    <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded p-3 flex flex-col gap-2">
                      <img alt={t.title} src={t.thumbnail || 'https://via.placeholder.com/300x200/4a9eff/ffffff?text=♫'} className="w-full h-36 object-cover rounded" />
                      <div className="text-sm font-medium line-clamp-2">{t.title}</div>
                      <div className="text-xs text-neutral-400">{t.artist} • {t.platform}</div>
                      <div className="flex gap-2">
                        <Button className="mt-1 flex-1" onClick={() => doPlay(t)}>Play</Button>
                        <Button className="mt-1" variant="ghost" onClick={() => addToQueue(t)}>+ Queue</Button>
                        <Button className="mt-1" variant="ghost" onClick={async () => {
                          // Persist then add to chosen playlist
                          const id = await persistTrack(t)
                          if (!id) { alert('Could not save track'); return }
                          let pid = activePlaylistId
                          if (!pid) {
                            const names = playlists.map((p, i) => `${i+1}. ${p.name}`)
                            const choice = prompt(`Add to which playlist?\n${names.join('\n')}\nOr type a new name:`)
                            if (!choice) return
                            const idx = Number(choice)-1
                            if (Number.isInteger(idx) && idx >= 0 && idx < playlists.length) pid = playlists[idx].id
                            else { createPlaylist(choice.trim()); pid = (playlists[playlists.length-1]?.id) }
                          }
                          addTrackToPlaylist(pid, t)
                          await window.electronAPI.addSongToPlaylist?.(pid, id)
                        }}>+ Playlist</Button>
                        <Button className="mt-1" variant="ghost" onClick={async () => {
                          const id = await persistTrack(t)
                          if (id) await window.electronAPI.toggleLikeSong?.(id)
                        }}>♥</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Queue panel */}
          <aside className="hidden md:flex flex-col gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-sm font-semibold mb-2">Queue</div>
              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {queue.length === 0 && <div className="text-xs text-neutral-500">Queue is empty</div>}
                {queue.map((q, i) => (
                  <div key={`${q.id}_${i}`} className="text-xs flex items-center gap-2">
                    <img src={q.thumbnail || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded object-cover"/>
                    <div className="flex-1 truncate">{q.title}</div>
                    <Button variant="ghost" onClick={() => playNext(q)}>Play next</Button>
                    <Button variant="ghost" onClick={() => removeFromQueue(i)}>Remove</Button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Now playing / insights & playlists */}
          <aside className="hidden lg:flex flex-col gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-sm font-semibold mb-2">Now playing</div>
              <audio id="audio-el" ref={audioRef} controls className="w-full" />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-sm font-semibold mb-2">Playlists</div>
              <div className="flex gap-2 mb-2">
                <Button onClick={() => createPlaylist(`Playlist ${playlists.length+1}`)}>New</Button>
              </div>
              <div className="space-y-2">
                {playlists.map(p => (
                  <div key={p.id} className={`border rounded p-2 ${activePlaylistId===p.id?'border-primary':'border-neutral-800'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-neutral-800 overflow-hidden flex items-center justify-center">
                          {p.cover ? <img src={p.cover} alt="cover" className="w-full h-full object-cover"/> : <span className="text-[10px] text-neutral-500">★</span>}
                        </div>
                        <div className="text-xs font-medium truncate">{p.name} <span className="text-neutral-500">({p.tracks.length})</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setActivePlaylistId(p.id)}>Open</Button>
                        <Button variant="ghost" onClick={() => {
                          const n = prompt('Rename playlist', p.name)
                          if (n && n.trim()) renamePlaylist(p.id, n.trim())
                        }}>Rename</Button>
                        <Button variant="ghost" onClick={() => {
                          const inp = document.createElement('input')
                          inp.type = 'file'
                          inp.accept = 'image/*'
                          inp.onchange = async (e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            const reader = new FileReader()
                            reader.onload = () => setPlaylistCover(p.id, reader.result)
                            reader.readAsDataURL(f)
                          }
                          inp.click()
                        }}>Cover</Button>
                      </div>
                    </div>
                    {activePlaylistId===p.id && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-auto pr-1">
                        {p.tracks.length === 0 && <div className="text-xs text-neutral-500">No tracks yet</div>}
                        {p.tracks.map((t, idx) => (
                          <div key={`${t.id}_${idx}`} className="text-xs flex items-center gap-2">
                            <img src={t.thumbnail || 'https://via.placeholder.com/28'} className="w-7 h-7 rounded object-cover"/>
                            <div className="flex-1 truncate">{t.title}</div>
                            <Button variant="ghost" onClick={() => doPlay(t)}>Play</Button>
                            <Button variant="ghost" onClick={() => removeTrackFromPlaylist(p.id, idx)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      </div>
      {/* Bottom player bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto max-w-screen-2xl px-4 h-20 flex items-center gap-4">
          {/* Track thumbnail and title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 bg-neutral-800 rounded overflow-hidden flex items-center justify-center">
              {currentTrack ? (
                <img alt={currentTrack.title} src={currentTrack.thumbnail || 'https://via.placeholder.com/56'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-500">♫</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate max-w-[220px]">{currentTrack?.title || 'Nothing playing'}</div>
              <div className="text-xs text-neutral-400 truncate max-w-[220px]">{currentTrack?.artist || ''}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col gap-1 items-center">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded hover:bg-neutral-800" onClick={() => nextFromQueue()} aria-label="Previous">
                <SkipBack size={18} />
              </button>
              <button className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlayPause} aria-label="Play/Pause">
                {isPlaying ? <Pause size={18}/> : <Play size={18}/>}
              </button>
              <button className="p-2 rounded hover:bg-neutral-800" onClick={() => nextFromQueue()} aria-label="Next">
                <SkipForward size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 w-full max-w-xl">
              <span className="text-[11px] text-neutral-400 w-10 text-right">{fmtTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                value={Math.min(progress, duration || 0)}
                onChange={(e) => { const t = Number(e.target.value); setProgress(t); if (audioRef.current) audioRef.current.currentTime = t }}
                className="w-full accent-primary"
              />
              <span className="text-[11px] text-neutral-400 w-10">{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="hidden md:flex items-center gap-2 w-48 justify-end">
            <button className="p-2 rounded hover:bg-neutral-800" onClick={() => setVolume(v => v > 0 ? 0 : 0.8)} aria-label="Mute">
              {volume > 0 ? <Volume2 size={18}/> : <VolumeX size={18}/>}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32 accent-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}


