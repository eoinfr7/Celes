import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'

const THEMES = [
  { name: 'Midnight', vars: { '--primary': '221.2 83.2% 53.3%', '--background': '0 0% 4%', '--foreground': '0 0% 100%' } },
  { name: 'Nord', vars: { '--primary': '210 34% 63%', '--background': '220 16% 16%', '--foreground': '220 14% 96%' } },
  { name: 'Dracula', vars: { '--primary': '265 89% 78%', '--background': '231 15% 18%', '--foreground': '60 30% 96%' } },
  { name: 'Solarized', vars: { '--primary': '186 72% 42%', '--background': '195 22% 17%', '--foreground': '44 55% 80%' } },
  { name: 'Neon', vars: { '--primary': '160 100% 45%', '--background': '240 10% 6%', '--foreground': '0 0% 100%' } },
  { name: 'Tumblr', vars: { '--primary': '210 50% 50%', '--background': '220 25% 12%', '--foreground': '210 40% 95%' } },
]

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

  // Playlists from DB
  const [playlists, setPlaylists] = useState([]) // [{id,name,type,songs:[...] }]
  const [activePlaylistId, setActivePlaylistId] = useState(null)
  const [playlistCovers, setPlaylistCovers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('celes.playlistCovers') || '{}') } catch { return {} }
  })
  const saveCovers = (next) => { setPlaylistCovers(next); try { localStorage.setItem('celes.playlistCovers', JSON.stringify(next)) } catch {} }

  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    try { const v = Number(localStorage.getItem('celes.volume')); return Number.isFinite(v)? Math.max(0, Math.min(1, v)) : 0.8 } catch { return 0.8 }
  })
  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const [crossfadeOn, setCrossfadeOn] = useState(true)
  const [crossfadeMs, setCrossfadeMs] = useState(4000)

  // WebAudio EQ
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const filtersRef = useRef([])
  const [eqOn, setEqOn] = useState(false)
  const [eqGains, setEqGains] = useState([0,0,0,0,0,0,0,0,0,0])
  const EQ_BANDS = [60, 120, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000]
  const EQ_PRESETS = {
    Flat: [0,0,0,0,0,0,0,0,0,0],
    Rock: [5,3,2,0,-1,1,2,3,4,5],
    Jazz: [3,2,1,0,1,2,3,2,1,0],
    Classical: [2,1,0,1,2,3,2,1,0,-1],
    BassBoost: [6,5,4,2,0,-1,-2,-3,-4,-5]
  }

  function ensureAudioGraph(){
    const el = audioRef.current
    if (!el) return
    if (!audioCtxRef.current){
      const ctx = new (window.AudioContext||window.webkitAudioContext)()
      const src = ctx.createMediaElementSource(el)
      const filters = EQ_BANDS.map((freq)=>{ const f=ctx.createBiquadFilter(); f.type='peaking'; f.frequency.value=freq; f.Q.value=1.1; f.gain.value=0; return f })
      src.connect(filters[0])
      for (let i=0;i<filters.length-1;i++) filters[i].connect(filters[i+1])
      filters[filters.length-1].connect(ctx.destination)
      audioCtxRef.current = ctx
      sourceRef.current = src
      filtersRef.current = filters
    }
  }

  function applyEqGains(gains){
    filtersRef.current.forEach((f,i)=>{ try{ f.gain.value = gains[i]||0 }catch{}})
  }

  function setEqPreset(name){
    const g = EQ_PRESETS[name] || EQ_PRESETS.Flat
    setEqGains(g)
    applyEqGains(g)
  }

  async function crossfadeTo(srcUrl){
    const a = audioRef.current
    const b = nextAudioRef.current
    if (!a || !b || !srcUrl){ return }
    if (!crossfadeOn || a.paused){
      a.src = srcUrl
      await a.play().catch(()=>{})
      setIsPlaying(!a.paused)
      return
    }
    b.volume = 0
    b.src = srcUrl
    try { await b.play() } catch {}
    const steps = Math.max(10, Math.floor(crossfadeMs/40))
    const step = crossfadeMs/steps
    let i=0
    const timer = setInterval(()=>{
      i++
      const t = i/steps
      a.volume = Math.max(0, 1-t)
      b.volume = Math.min(1, t)
      if (i>=steps){
        clearInterval(timer)
        a.pause(); a.src=''; a.volume=1
        // swap refs: make b the main player by swapping elements
        const tmp = audioRef.current
        audioRef.current = nextAudioRef.current
        nextAudioRef.current = tmp
        setIsPlaying(true)
      }
    }, step)
  }

  async function prefetchForQueue(){
    const next = queue[0]
    if (!next) return
    try {
      const toProxy = (u) => `celes-stream://proxy?u=${encodeURIComponent(u)}`
      const res = await window.electronAPI.getStreamUrlWithFallback(next.id, next.platform||'youtube')
      if (res?.streamUrl) { next._prefetched = toProxy(res.streamUrl) }
    } catch {}
  }

  async function reloadPlaylists() {
    const res = await window.electronAPI.getPlaylists?.()
    setPlaylists(Array.isArray(res) ? res : [])
  }

  // Home: daily mixes / charts
  const [dailyMix, setDailyMix] = useState([])
  const [chartsSC, setChartsSC] = useState([])
  const [chartsYT, setChartsYT] = useState([])
  const [followedFeed, setFollowedFeed] = useState([])
  const [homeLoading, setHomeLoading] = useState(false)
  const [chartsDate, setChartsDate] = useState('')

  async function loadHome() {
    setHomeLoading(true)
    try {
      const radar = await window.electronAPI.getReleaseRadar?.(24)
      setDailyMix(Array.isArray(radar) ? radar : [])
      const yt = await window.electronAPI.getTopCharts?.('youtube', 50)
      setChartsYT(yt || [])
      const sc = await window.electronAPI.getTopCharts?.('soundcloud', 50)
      setChartsSC(sc || [])
      const fol = await window.electronAPI.getFollowedArtistsTracks?.(30)
      setFollowedFeed(fol || [])
      setChartsDate(new Date().toLocaleDateString())
    } finally { setHomeLoading(false) }
  }

  async function doSearch() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await window.electronAPI.searchMusicWithFallback(query, 'youtube', 24)
      setResults(res || [])
    } finally {
      setLoading(false)
    }
  }

  async function doPlay(track) {
    const a = audioRef.current
    if (!a) return
    const toProxy = (u) => `celes-stream://proxy?u=${encodeURIComponent(u)}`
    let src = track?.streamUrl ? toProxy(track.streamUrl) : null
    if (!src) {
      const prefPlat = track.platform || 'internetarchive'
      const result = await window.electronAPI.getStreamUrlWithFallback(track.id, prefPlat).catch(() => null)
      if (result?.streamUrl) src = toProxy(result.streamUrl)
    }
    if (!src) return
    ensureAudioGraph(); if (eqOn) applyEqGains(eqGains)
    await crossfadeTo(src)
    setCurrentTrack(track)
    prefetchForQueue()
  }

  function addToQueue(track) { setQueue((q) => [...q, track]) }
  function playNext(track) { setQueue((q) => [track, ...q]) }
  function removeFromQueue(idx) { setQueue((q) => q.filter((_, i) => i !== idx)) }

  async function persistTrack(track) {
    try {
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
    } catch { return null }
  }

  async function createPlaylist(name) {
    const res = await window.electronAPI.createPlaylist?.(name)
    await reloadPlaylists();
    if (res?.playlistId) setActivePlaylistId(res.playlistId)
  }

  async function renamePlaylist(playlistId, newName) {
    await window.electronAPI.renamePlaylist?.(playlistId, newName)
    await reloadPlaylists()
  }

  async function deletePlaylist(playlistId) {
    await window.electronAPI.deletePlaylist?.(playlistId)
    if (activePlaylistId === playlistId) setActivePlaylistId(null)
    await reloadPlaylists()
  }

  async function setPlaylistCover(playlistId, dataUrl) {
    const next = { ...playlistCovers, [playlistId]: dataUrl }
    saveCovers(next)
    await window.electronAPI.updatePlaylistCover?.(playlistId, dataUrl)
  }

  async function addTrackToDbPlaylist(playlistId, track) {
    const id = await persistTrack(track)
    if (!id) { alert('Could not save track'); return }
    await window.electronAPI.addSongToPlaylist?.(playlistId, id)
    await reloadPlaylists()
  }

  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || null

  function nextFromQueue() {
    setQueue((q) => {
      if (q.length === 0) { setIsPlaying(false); return q }
      const [next, ...rest] = q
      void doPlay(next)
      return rest
    })
  }

  function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play().then(() => setIsPlaying(true)).catch(() => {}) } else { audio.pause(); setIsPlaying(false) }
  }

  function fmtTime(s) { if (!Number.isFinite(s) || s < 0) return '0:00'; const m=Math.floor(s/60); const ss=Math.floor(s%60).toString().padStart(2,'0'); return `${m}:${ss}` }

  useEffect(() => { if (view === 'home') loadHome() }, [view])
  useEffect(() => { reloadPlaylists() }, [])

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
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); setPaletteOpen(v=>!v) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
              <Button className="mt-1" variant="ghost" onClick={async () => {
                let pid = activePlaylistId
                if (!pid || !playlists.find(p=>p.id===pid)) {
                  const names = playlists.map((p, i) => `${i+1}. ${p.name}`)
                  const choice = prompt(`Add to which playlist?\n${names.join('\n')}\nOr type a new name:`)
                  if (!choice) return
                  const idx = Number(choice)-1
                  if (Number.isInteger(idx) && idx >= 0 && idx < playlists.length) pid = playlists[idx].id
                  else { const created = await createPlaylist(choice.trim()); pid = playlists[playlists.length-1]?.id }
                }
                await addTrackToDbPlaylist(pid, t)
              }}>+ Playlist</Button>
              <Button className="mt-1" variant="ghost" onClick={async () => {
                const id = await persistTrack(t)
                if (id) await window.electronAPI.toggleLikeSong?.(id)
              }}>♥</Button>
              <Button className="mt-1" variant="ghost" onClick={async ()=>{ try { await window.electronAPI.followArtistStreaming?.(t.artist); alert(`Following ${t.artist}`)} catch{} }}>Follow</Button>
              <Button className="mt-1" variant="ghost" onClick={async ()=>{ try { await window.electronAPI.unfollowArtistStreaming?.(t.artist); alert(`Unfollowed ${t.artist}`)} catch{} }}>Unfollow</Button>
              <Button className="mt-1" variant="ghost" onClick={async ()=>{
                // Simple radio: fetch similar and queue them
                const sim = await window.electronAPI.getSimilarTracks?.(t.id, t.platform||'youtube', 20)
                if (Array.isArray(sim)) sim.forEach(addToQueue)
              }}>Radio</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const [themeOpen, setThemeOpen] = useState(false)

  function applyThemeVars(vars) {
    const root = document.documentElement
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k, v))
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('celes.theme') || 'null')
      if (saved) applyThemeVars(saved)
    } catch {}
  }, [])

  function ThemePanel() {
    const [primary, setPrimary] = useState(getComputedStyle(document.documentElement).getPropertyValue('--primary'))
    const [bg, setBg] = useState(getComputedStyle(document.documentElement).getPropertyValue('--background') || '0 0% 4%')
    const [fg, setFg] = useState(getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '0 0% 100%')
    const [preset, setPreset] = useState('')

    const onPreset = (val) => {
      setPreset(val)
      const t = THEMES.find(x => x.name === val)
      if (t) {
        setPrimary(t.vars['--primary'])
        setBg(t.vars['--background'])
        setFg(t.vars['--foreground'])
      }
    }

    const save = () => {
      const vars = { '--primary': primary.trim(), '--background': bg.trim(), '--foreground': fg.trim() }
      applyThemeVars(vars)
      try { localStorage.setItem('celes.theme', JSON.stringify(vars)) } catch {}
      setThemeOpen(false)
    }

    return (
      <div className="fixed right-4 top-16 z-50 bg-neutral-900 border border-neutral-800 rounded p-3 w-80 shadow-xl">
        <div className="text-sm font-semibold mb-2">Theme</div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="mb-1">Preset</div>
            <select className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1" value={preset} onChange={(e)=>onPreset(e.target.value)}>
              <option value="">Custom…</option>
              {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1">Primary (H S L)</div>
            <input className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1" value={primary} onChange={(e)=>setPrimary(e.target.value)} />
          </div>
          <div>
            <div className="mb-1">Background (H S L)</div>
            <input className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1" value={bg} onChange={(e)=>setBg(e.target.value)} />
          </div>
          <div>
            <div className="mb-1">Foreground (H S L)</div>
            <input className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1" value={fg} onChange={(e)=>setFg(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={save}>Save</Button>
            <Button variant="ghost" onClick={()=>setThemeOpen(false)}>Close</Button>
          </div>
          <div className="pt-2 text-neutral-400">Tip: presets change HSL variables globally.</div>
        </div>
      </div>
    )
  }

  function CommandPalette(){
    const [input, setInput] = useState('')
    const commands = [
      {name:'Go Home', run:()=>setView('home')},
      {name:'Open Search', run:()=>setView('search')},
      {name:'New Playlist', run:()=>{ const n=prompt('New playlist name','My Playlist'); if(n) createPlaylist(n)}},
      {name:'Toggle Theme Panel', run:()=>setThemeOpen(v=>!v)},
      {name:'Open Liked Songs', run:()=>{ const liked=playlists.find(p=>p.name==='Liked Songs'); if(liked) setActivePlaylistId(liked.id); }}
    ]
    const filtered = commands.filter(c=>c.name.toLowerCase().includes(input.toLowerCase()))
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-32" onClick={()=>setPaletteOpen(false)}>
        <div className="w-[560px] bg-neutral-900 border border-neutral-800 rounded shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <input autoFocus className="w-full bg-neutral-950 border-b border-neutral-800 px-3 py-2 text-sm" placeholder="Type a command…" value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Escape') setPaletteOpen(false)}} />
          <div className="max-h-80 overflow-auto">
            {filtered.map((c,i)=>(
              <div key={i} className="px-3 py-2 text-sm hover:bg-neutral-800 cursor-pointer" onClick={()=>{ c.run(); setPaletteOpen(false) }}>{c.name}</div>
            ))}
            {filtered.length===0 && <div className="px-3 py-3 text-xs text-neutral-500">No commands</div>}
          </div>
        </div>
      </div>
    )
  }

  const [paletteOpen, setPaletteOpen] = useState(false)

  function SettingsPanel(){
    return (
      <div className="fixed right-4 top-16 z-50 bg-neutral-900 border border-neutral-800 rounded p-3 w-96 shadow-xl">
        <div className="text-sm font-semibold mb-2">Settings</div>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between"><div>Crossfade</div><input type="checkbox" checked={crossfadeOn} onChange={(e)=>setCrossfadeOn(e.target.checked)} /></div>
          <div>
            <div className="mb-1">Crossfade Duration (ms)</div>
            <input type="number" className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1" value={crossfadeMs} onChange={(e)=>setCrossfadeMs(Number(e.target.value)||0)} />
          </div>
          <div className="flex items-center justify-between"><div>Equalizer</div><input type="checkbox" checked={eqOn} onChange={(e)=>{ setEqOn(e.target.checked); if(e.target.checked) ensureAudioGraph(); }} /></div>
          <div className="flex gap-2 items-center">
            <div>Preset:</div>
            <select className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1" onChange={(e)=>setEqPreset(e.target.value)}>
              {Object.keys(EQ_PRESETS).map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {EQ_BANDS.map((f,i)=> (
              <div key={f} className="flex flex-col items-center">
                <div className="text-[10px] mb-1">{f/1000>=1?`${f/1000}k`:`${f}`}</div>
                <input type="range" min={-12} max={12} step={1} value={eqGains[i]||0} onChange={(e)=>{ const g=[...eqGains]; g[i]=Number(e.target.value); setEqGains(g); applyEqGains(g) }} className="h-20 rotate-[-90deg] origin-left w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      <Sidebar onSelect={setView} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-neutral-800 flex items-center px-4 gap-3">
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 flex-1 max-w-3xl">
            <input className="bg-transparent outline-none text-sm w-full" placeholder="Ask for any song, artist, mood…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
            <Button onClick={doSearch} disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
          </div>
          <Button variant="ghost" onClick={()=>setThemeOpen(v=>!v)}>Theme</Button>
          <Button variant="ghost" onClick={()=>setSettingsOpen(v=>!v)}>Settings</Button>
          <Button variant="ghost" onClick={()=>window.electronAPI.openMiniPlayer?.()}>Mini</Button>
          <div className="md:hidden flex-1" />
        </header>

        <main className="flex-1 grid lg:grid-cols-[1fr_320px_340px] md:grid-cols-[1fr_320px] gap-4 p-4 pb-28">
          <section className="space-y-3">
            {view === 'home' && (
              <>
                {homeLoading && <div className="text-sm text-neutral-400">Loading mixes…</div>}
                {!homeLoading && (<>
                  <SectionCard title={`Daily Mix • ${chartsDate}`} items={dailyMix} />
                  <SectionCard title={`YouTube Top 50 • ${chartsDate}`} items={chartsYT} />
                  <SectionCard title={`SoundCloud Top 50 • ${chartsDate}`} items={chartsSC} />
                  <SectionCard title={`From Artists You Follow • ${chartsDate}`} items={followedFeed} />
                </>)}
              </>
            )}
            {view === 'search' && (
              <>
                {!results.length && <div className="text-sm text-neutral-400">Type anything – e.g. “calming piano at night”, “vocal jazz 50s”, “beethoven sonata 14”.</div>}
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
                          let pid = activePlaylistId
                          if (!pid || !playlists.find(p=>p.id===pid)) {
                            const names = playlists.map((p, i) => `${i+1}. ${p.name}`)
                            const choice = prompt(`Add to which playlist?\n${names.join('\n')}\nOr type a new name:`)
                            if (!choice) return
                            const idx = Number(choice)-1
                            if (Number.isInteger(idx) && idx >= 0 && idx < playlists.length) pid = playlists[idx].id
                            else { await createPlaylist(choice.trim()); pid = playlists[playlists.length-1]?.id }
                          }
                          await addTrackToDbPlaylist(pid, t)
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

          <aside className="hidden lg:flex flex-col gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-sm font-semibold mb-2">Now playing</div>
              <audio id="audio-el" ref={audioRef} controls className="w-full" />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-sm font-semibold mb-2">Playlists</div>
              <div className="flex gap-2 mb-2">
                <Button onClick={() => {
                  const n = prompt('New playlist name', `Playlist ${playlists.length+1}`)
                  if (n && n.trim()) createPlaylist(n.trim())
                }}>New</Button>
                {activePlaylist && activePlaylist.type !== 'system' && (
                  <>
                    <Button variant="ghost" onClick={() => {
                      // export JSON
                      const data = JSON.stringify({ name: activePlaylist.name, tracks: activePlaylist.songs || [] }, null, 2)
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type:'application/json'})); a.download = `${activePlaylist.name}.json`; a.click();
                    }}>Export</Button>
                    <Button variant="ghost" onClick={() => {
                      const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
                      inp.onchange = async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text().catch(()=>null); if(!text) return; try { const json = JSON.parse(text); const name = json.name || `Imported ${Date.now()}`; await createPlaylist(name); const pl = playlists.find(p=>p.name===name) || (await reloadPlaylists(), playlists.find(p=>p.name===name)); const pid = pl?.id; for (const t of json.tracks || []) { await addTrackToDbPlaylist(pid, t) } } catch {} }
                      inp.click()
                    }}>Import</Button>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {playlists.map(p => (
                  <div key={p.id} className={`border rounded p-2 ${activePlaylistId===p.id?'border-primary':'border-neutral-800'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-neutral-800 overflow-hidden flex items-center justify-center">
                          {playlistCovers[p.id] ? <img src={playlistCovers[p.id]} alt="cover" className="w-full h-full object-cover"/> : <span className="text-[10px] text-neutral-500">★</span>}
                        </div>
                        <div className="text-xs font-medium truncate">{p.name} <span className="text-neutral-500">({p.songs?.length || 0})</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setActivePlaylistId(p.id)}>Open</Button>
                        {p.type !== 'system' && (
                          <>
                            <Button variant="ghost" onClick={() => { const n = prompt('Rename playlist', p.name); if (n && n.trim()) renamePlaylist(p.id, n.trim()) }}>Rename</Button>
                            <Button variant="ghost" onClick={() => {
                              const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => setPlaylistCover(p.id, reader.result); reader.readAsDataURL(f); }; inp.click();
                            }}>Cover</Button>
                            <Button variant="ghost" onClick={() => { if (confirm(`Delete playlist "${p.name}"?`)) deletePlaylist(p.id) }}>Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                    {activePlaylistId===p.id && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-auto pr-1">
                        {(p.songs?.length || 0) === 0 && <div className="text-xs text-neutral-500">No tracks yet</div>}
                        {(p.songs || []).map((t, idx) => (
                          <div key={`${t.id}_${idx}`} className="text-xs flex items-center gap-2">
                            <img src={t.thumbnail_url || t.thumbnail || 'https://via.placeholder.com/28'} className="w-7 h-7 rounded object-cover"/>
                            <div className="flex-1 truncate">{t.title}</div>
                            <Button variant="ghost" onClick={() => doPlay({ ...t, platform: t.platform || t.type === 'stream' ? t.platform : 'internetarchive' })}>Play</Button>
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
      {paletteOpen && <CommandPalette />}
      {themeOpen && <ThemePanel />}
      {settingsOpen && <SettingsPanel />}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto max-w-screen-2xl px-4 h-20 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 bg-neutral-800 rounded overflow-hidden flex items-center justify-center">
              {currentTrack ? (<img alt={currentTrack.title} src={currentTrack.thumbnail || 'https://via.placeholder.com/56'} className="w-full h-full object-cover" />) : (<span className="text-xs text-neutral-500">♫</span>)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate max-w-[220px]">{currentTrack?.title || 'Nothing playing'}</div>
              <div className="text-xs text-neutral-400 truncate max-w-[220px]">{currentTrack?.artist || ''}</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1 items-center">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded hover:bg-neutral-800" onClick={() => nextFromQueue()} aria-label="Previous"><SkipBack size={18} /></button>
              <button className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlayPause} aria-label="Play/Pause">{isPlaying ? <Pause size={18}/> : <Play size={18}/>}</button>
              <button className="p-2 rounded hover:bg-neutral-800" onClick={() => nextFromQueue()} aria-label="Next"><SkipForward size={18} /></button>
            </div>
            <div className="flex items-center gap-3 w-full max-w-xl">
              <span className="text-[11px] text-neutral-400 w-10 text-right">{fmtTime(progress)}</span>
              <input type="range" min={0} max={Math.max(1, duration)} value={Math.min(progress, duration || 0)} onChange={(e) => { const t = Number(e.target.value); setProgress(t); if (audioRef.current) audioRef.current.currentTime = t }} className="w-full accent-primary" />
              <span className="text-[11px] text-neutral-400 w-10">{fmtTime(duration)}</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 w-48 justify-end">
            <button className="p-2 rounded hover:bg-neutral-800" onClick={() => setVolume(v => v > 0 ? 0 : 0.8)} aria-label="Mute">{volume > 0 ? <Volume2 size={18}/> : <VolumeX size={18}/>} </button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32 accent-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}


