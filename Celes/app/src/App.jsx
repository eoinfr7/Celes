import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Plus, ListPlus } from 'lucide-react'

const THEMES = [
  // Keep black/dark backgrounds here
  { name: 'Midnight', vars: { '--primary': '221.2 83.2% 53.3%', '--background': '0 0% 4%', '--foreground': '0 0% 100%' } },
  { name: 'Lilac', vars: { '--primary': '265 89% 78%', '--background': '231 15% 18%', '--foreground': '60 30% 96%' } },
  // Light/tinted backgrounds for most themes
  { name: 'Nord', vars: { '--primary': '210 34% 63%', '--background': '220 16% 94%', '--foreground': '220 15% 10%' } },
  { name: 'Solarized', vars: { '--primary': '186 72% 42%', '--background': '45 52% 94%', '--foreground': '25 40% 15%' } },
  { name: 'Neon', vars: { '--primary': '160 100% 45%', '--background': '240 10% 96%', '--foreground': '0 0% 12%' } },
  { name: 'Tumblr', vars: { '--primary': '210 50% 50%', '--background': '210 30% 94%', '--foreground': '210 30% 12%' } },
  { name: 'Light Green', vars: { '--primary': '142 70% 40%', '--background': '0 0% 98%', '--foreground': '0 0% 10%' } },
  { name: 'Coral Blue', vars: { '--primary': '14 90% 60%', '--background': '205 40% 94%', '--foreground': '210 30% 10%' } },
  { name: 'Silver', vars: { '--primary': '0 0% 60%', '--background': '0 0% 96%', '--foreground': '0 0% 12%' } },
]

function Button({ className = '', variant = 'primary', ...props }) {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2'
  const styles = variant === 'ghost'
    ? 'bg-transparent hover:bg-surface-muted border border-border text-foreground/90'
    : 'bg-primary text-primary-foreground hover:bg-primary/90'
  return <button className={`${base} ${styles} ${className}`} {...props} />
}

function Sidebar({ onSelect }) {
  return (
    <aside className="w-60 border-r border-border h-screen sticky top-0 hidden md:flex flex-col bg-surface">
      <div className="px-4 py-3 text-lg font-semibold flex items-center gap-2">
        <img src="/assets/icons/celes-star.svg" alt="Celes" className="w-5 h-5 opacity-90" />
        Celes
      </div>
      <nav className="px-2 py-2 space-y-1">
        {[
          ['home', 'Home'],
          ['search', 'Search'],
          ['library', 'Library'],
          ['downloads', 'Downloads'],
        ].map(([key, label]) => (
          <Button key={key} variant="ghost" className="w-full justify-start" onClick={() => onSelect(key)}>{label}</Button>
        ))}
      </nav>
      <div className="mt-auto p-3 text-xs text-muted-foreground">Open source alternative to Spotify</div>
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
  const [radioOn, setRadioOn] = useState(() => {
    try { const v = localStorage.getItem('celes.radioOn'); return v == null ? true : v === 'true' } catch { return true }
  })

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
  const isSeekingRef = useRef(false)
  const [volume, setVolume] = useState(() => {
    try { const v = Number(localStorage.getItem('celes.volume')); return Number.isFinite(v)? Math.max(0, Math.min(1, v)) : 0.8 } catch { return 0.8 }
  })
  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const [activeSide, setActiveSide] = useState('main') // 'main' or 'next'
  const getActiveEl = () => (activeSide === 'main' ? audioRef.current : nextAudioRef.current)
  const getInactiveEl = () => (activeSide === 'main' ? nextAudioRef.current : audioRef.current)
  const queueRef = useRef([])
  const radioOnRef = useRef(radioOn)
  const currentTrackRef = useRef(null)
  const [crossfadeOn, setCrossfadeOn] = useState(true)
  const [crossfadeMs, setCrossfadeMs] = useState(4000)
  const [gaplessOn, setGaplessOn] = useState(true)
  const [normalizeOn, setNormalizeOn] = useState(true)
  const [targetLufs, setTargetLufs] = useState(-14)
  // UI + lyrics/download state (declare early so effects can reference)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [lyricsData, setLyricsData] = useState(null)
  const [parsedLrc, setParsedLrc] = useState([])
  const [activeLrcIdx, setActiveLrcIdx] = useState(-1)
  const parsedLrcRef = useRef([])
  const activeLrcIdxRef = useRef(-1)
  const [miniLyric, setMiniLyric] = useState('')
  const [lyricsEnabled, setLyricsEnabled] = useState(()=>{ try { const v = localStorage.getItem('celes.lyricsEnabled'); return v==null? true : v==='true' } catch { return true } })
  const [autoOpenLyrics, setAutoOpenLyrics] = useState(()=>{ try { const v = localStorage.getItem('celes.autoOpenLyrics'); return v==='true' } catch { return false } })
  const [showMiniLyric, setShowMiniLyric] = useState(()=>{ try { const v = localStorage.getItem('celes.showMiniLyric'); return v==null? true : v==='true' } catch { return true } })
  const [autoDownloadLiked, setAutoDownloadLiked] = useState(false)
  const [downloadDir, setDownloadDir] = useState('')
  const [playlistDl, setPlaylistDl] = useState({})
  const playlistDlRef = useRef(new Map())
  const [theaterOn, setTheaterOn] = useState(false)
  const [videoOn, setVideoOn] = useState(false)
  const videoRef = useRef(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [miniDockOn, setMiniDockOn] = useState(() => { try { return localStorage.getItem('celes.miniDockOn') === 'true' } catch { return false } })
  const [dockVisOn, setDockVisOn] = useState(false)
  const [dockVideoOn, setDockVideoOn] = useState(false)
  const dockVideoRef = useRef(null)
  const [dockVideoUrl, setDockVideoUrl] = useState(null)
  const [dockVideoId, setDockVideoId] = useState(null)
  const [dockVideoFailed, setDockVideoFailed] = useState(false)

  function deriveYouTubeId(track){
    try {
      if (!track) return null
      const tryId = (s)=>{ const x=String(s||''); return /^[a-zA-Z0-9_-]{11}$/.test(x)? x.slice(0,11) : null }
      const id1 = tryId(track.id)
      if (id1) return id1
      const id2 = tryId(track.stream_id)
      if (id2) return id2
      const tryUrl = String(track.url||track.stream_url||'')
      if (tryUrl.includes('watch?v=')) { const v = new URL(tryUrl).searchParams.get('v'); const id = tryId(v); if (id) return id }
      if (tryUrl.includes('youtu.be/')) { const id = tryUrl.split('youtu.be/')[1]?.slice(0,11); const ok = tryId(id); if (ok) return ok }
      return null
    } catch { return null }
  }

  // WebAudio EQ
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const normalizeGainRef = useRef(null)
  const analyserRef = useRef(null)
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

  function buildAudioGraphFor(el){
    if (!el) return
    const ctx = audioCtxRef.current || new (window.AudioContext||window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const src = ctx.createMediaElementSource(el)
    const norm = ctx.createGain();
    norm.gain.value = 1
    const filters = EQ_BANDS.map((freq)=>{ const f=ctx.createBiquadFilter(); f.type='peaking'; f.frequency.value=freq; f.Q.value=1.1; f.gain.value=0; return f })
    // chain: src -> norm -> filters... -> dest
    src.connect(norm)
    norm.connect(filters[0])
    for (let i=0;i<filters.length-1;i++) filters[i].connect(filters[i+1])
    const last = filters[filters.length-1]
    last.connect(ctx.destination)
    // visualizer analyser (tap)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85
    last.connect(analyser)
    analyserRef.current = analyser
    sourceRef.current = src
    normalizeGainRef.current = norm
    filtersRef.current = filters
  }

  function ensureAudioGraph(){
    const el = getActiveEl()
    if (!el) return
    if (!audioCtxRef.current || !sourceRef.current){
      buildAudioGraphFor(el)
    }
  }

  function rebuildAudioGraph(){
    try {
      const ctx = audioCtxRef.current
      if (!ctx) { ensureAudioGraph(); return }
      // let GC handle old nodes; just rebuild for new element
      buildAudioGraphFor(getActiveEl())
      if (eqOn) applyEqGains(eqGains)
    } catch {}
  }

  function applyEqGains(gains){
    filtersRef.current.forEach((f,i)=>{ try{ f.gain.value = gains[i]||0 }catch{}})
  }

  function parseLrc(lrc){
    try {
      const lines = []
      const rx = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/
      for (const raw of (lrc||'').split(/\r?\n/)){
        const m = raw.match(rx)
        if (!m) continue
        const mm = parseInt(m[1],10)
        const ss = parseInt(m[2],10)
        const ms = m[3]? parseInt(m[3].padEnd(3,'0'),10) : 0
        const t = mm*60 + ss + (ms/1000)
        const text = (m[4]||'').trim()
        if (text) lines.push({ t, text })
      }
      return lines.sort((a,b)=>a.t-b.t)
    } catch { return [] }
  }

  function updateActiveLyric(currentTime){
    try {
      const arr = parsedLrcRef.current
      if (!arr || arr.length===0) { if (activeLrcIdxRef.current!==-1){ activeLrcIdxRef.current=-1; setActiveLrcIdx(-1); setMiniLyric('') } return }
      let lo=0, hi=arr.length-1, idx=-1
      while (lo<=hi){ const mid=(lo+hi>>1); if (arr[mid].t<=currentTime){ idx=mid; lo=mid+1 } else { hi=mid-1 } }
      if (idx !== activeLrcIdxRef.current){
        activeLrcIdxRef.current = idx
        setActiveLrcIdx(idx)
        setMiniLyric(idx>=0? arr[idx].text : '')
        const el = document.getElementById('lrc-line-'+idx)
        if (el) el.scrollIntoView({ block:'center', behavior:'smooth' })
      }
    } catch {}
  }

  async function applyNormalizationForTrack(track){
    try {
      if (!normalizeOn || !track) { if (normalizeGainRef.current) normalizeGainRef.current.gain.value = 1; return }
      const res = await window.electronAPI.getTrackLoudness?.(track.id, track.platform||'youtube', { force:false })
      const measured = res?.integratedLufs
      const target = Number(targetLufs) || -14
      const deltaDb = Number.isFinite(measured) ? (target - measured) : 0
      const linear = Math.pow(10, deltaDb/20)
      if (normalizeGainRef.current) normalizeGainRef.current.gain.value = linear
    } catch {}
  }

  function setEqPreset(name){
    const g = EQ_PRESETS[name] || EQ_PRESETS.Flat
    setEqGains(g)
    applyEqGains(g)
  }

  async function crossfadeTo(srcUrl, fadeMs){
    const a = getActiveEl()
    const b = getInactiveEl()
    if (!a || !srcUrl){ return }
    // If crossfade disabled or we don't have a second element, play directly
    if (!crossfadeOn || a.paused || !b){
      a.src = srcUrl
      try { await a.play() } catch {}
      setIsPlaying(!a.paused)
      return
    }
    b.volume = 0
    b.src = srcUrl
    try { await b.play() } catch {}
    const useMs = Number.isFinite(fadeMs) ? Math.max(50, fadeMs) : crossfadeMs
    const steps = Math.max(6, Math.floor(useMs/40))
    const step = useMs/steps
    let i=0
    const timer = setInterval(()=>{
      i++
      const t = i/steps
      a.volume = Math.max(0, 1-t)
      b.volume = Math.min(1, t)
      if (i>=steps){
        clearInterval(timer)
        try { a.pause() } catch {}
        try { a.src='' } catch {}
        a.volume=1; b.volume=1
        setIsPlaying(true)
        setActiveSide(prev => prev === 'main' ? 'next' : 'main')
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
      // Do not auto-load into next element; we will lazy set src when transitioning
    } catch {}
  }

  const radioCooldownRef = useRef(0)
  const radioAddingRef = useRef(false)
  function keyForTrack(t){ return `${t.platform||'youtube'}:${String(t.id)}` }
  async function ensureRadioQueue(){
    try {
      if (!radioOnRef.current || !currentTrackRef.current) return
      const now = Date.now()
      if (radioAddingRef.current || (now - radioCooldownRef.current) < 4000) return
      const q = queueRef.current || []
      if (q.length >= 1) return
      radioAddingRef.current = true
      const ct = currentTrackRef.current
      const sim = await window.electronAPI.getSimilarTracks?.(ct.id, ct.platform||'youtube', 12)
      const existing = new Set([keyForTrack(ct), ...q.map(keyForTrack)])
      const pick = (sim || []).find(t => !existing.has(keyForTrack(t)))
      if (pick) setQueue(prev => [...prev, pick])
      radioCooldownRef.current = Date.now()
    } catch {} finally { radioAddingRef.current = false }
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

  async function doPlay(track, options = {}) {
    const a = audioRef.current
    if (!a) return
    const toProxy = (u) => `celes-stream://proxy?u=${encodeURIComponent(u)}`
    // Reset any lingering next element source to avoid double-playing
    if (nextAudioRef.current) { try { nextAudioRef.current.pause(); nextAudioRef.current.src = '' } catch {} }
    let src = track?._prefetched || (track?.streamUrl ? toProxy(track.streamUrl) : null)
    if (!src) {
      const prefPlat = track.platform || 'youtube'
      const result = await window.electronAPI.getStreamUrlWithFallback(track.id, prefPlat).catch(() => null)
      if (result?.streamUrl) src = toProxy(result.streamUrl)
    }
    // Intelligent fallback: if primary resolution failed, try re-searching by title+artist and pick first playable
    if (!src) {
      try {
        const q = [track.artist, track.title].filter(Boolean).join(' ')
        const alts = await window.electronAPI.searchMusicWithFallback(q, 'youtube', 5)
        if (Array.isArray(alts)) {
          for (const cand of alts) {
            const got = await window.electronAPI.getStreamUrlWithFallback(cand.id, cand.platform||'youtube').catch(()=>null)
            if (got?.streamUrl) {
              src = toProxy(got.streamUrl)
              track = { ...cand }
              break
            }
          }
        }
      } catch {}
    }
    if (!src) return
    ensureAudioGraph(); if (eqOn) applyEqGains(eqGains)
    await crossfadeTo(src, options.fadeMs)
    rebuildAudioGraph()
    await applyNormalizationForTrack(track)
    setCurrentTrack(track)
    // Reset Theater video if platform changes or new track
    try {
      const newVid = deriveYouTubeId(track)
      if (!newVid) { setVideoOn(false); setVideoUrl(null); const el = videoRef.current; if (el) { try { el.pause() } catch {}; el.src='' } }
    } catch {}
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

  const isSwitchingRef = useRef(false)
  function nextFromQueue() {
    if (isSwitchingRef.current) return
    isSwitchingRef.current = true
    setQueue((q) => {
      if (q.length === 0) { setIsPlaying(false); isSwitchingRef.current = false; return q }
      const [next, ...rest] = q
      Promise.resolve().then(async ()=>{ try { await doPlay(next, { fadeMs: 250 }) } finally { isSwitchingRef.current = false } })
      return rest
    })
  }

  function previousOrRestart() {
    const a = getActiveEl()
    if (!a) return
    if ((a.currentTime || 0) > 3) { try { a.currentTime = 0 } catch {} ; return }
    // No full history stack; replay currentTrack or do nothing
    if (currentTrack) { void doPlay(currentTrack, { fadeMs: 150 }) }
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
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    radioOnRef.current = radioOn
    try { localStorage.setItem('celes.radioOn', String(radioOn)) } catch {}
  }, [radioOn])

  useEffect(() => {
    currentTrackRef.current = currentTrack
    if (currentTrack && radioOn) { void ensureRadioQueue() }
  }, [currentTrack, radioOn])

  useEffect(() => { if (radioOn) { void ensureRadioQueue() } }, [radioOn])

  useEffect(() => { if (radioOn && (queue.length < 1)) { void ensureRadioQueue() } }, [queue.length, radioOn])

  useEffect(() => {
    const audio = getActiveEl()
    if (!audio) return
    // keep both elements at same volume for seamless switching
    try { if (audioRef.current) audioRef.current.volume = volume } catch {}
    try { if (nextAudioRef.current) nextAudioRef.current.volume = volume } catch {}
    const onTime = () => { if (!isSeekingRef.current) setProgress(audio.currentTime || 0) }
    // lyrics handled by RAF loop for tighter sync
    const onDur = () => setDuration(audio.duration || 0)
    const onSeeking = () => { /* no-op, we manage via ref */ }
    const onSeeked = () => { isSeekingRef.current = false }
    const onEnd = async () => { if (queueRef.current.length === 0) { await ensureRadioQueue() } nextFromQueue() }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    // audio.addEventListener('timeupdate', onTimeLyrics)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('seeking', onSeeking)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      // audio.removeEventListener('timeupdate', onTimeLyrics)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('seeking', onSeeking)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [activeSide, volume])

  useEffect(() => { try { localStorage.setItem('celes.volume', String(volume)) } catch {} ; try { if (audioRef.current) audioRef.current.volume = volume } catch {}; try { if (nextAudioRef.current) nextAudioRef.current.volume = volume } catch {} }, [volume])
  useEffect(() => { window.electronAPI.streamingHealthCheck?.() }, [])
  useEffect(() => { try { localStorage.setItem('celes.miniDockOn', String(miniDockOn)) } catch {} }, [miniDockOn])
  // High-frequency lyrics sync to reduce perceived lag
  useEffect(() => {
    if (!lyricsEnabled) return
    let raf = 0
    const loop = () => {
      try {
        const a = getActiveEl()
        if (a && !a.paused) updateActiveLyric(a.currentTime || 0)
      } catch {}
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [lyricsEnabled, activeSide])
  useEffect(() => {
    const onCmd = (payload) => {
      try {
        if (!payload || typeof payload !== 'object') return
        if (payload.type === 'toggle-play') { togglePlayPause() }
        if (payload.type === 'next') { nextFromQueue() }
        if (payload.type === 'previous') { /* optional: implement */ }
      } catch {}
    }
    window.electronAPI?.onRendererCommand?.(onCmd)
  }, [])
  useEffect(() => { if (currentTrack) applyNormalizationForTrack(currentTrack) }, [normalizeOn, targetLufs])
  useEffect(() => {
    setParsedLrc([]); parsedLrcRef.current=[]; setActiveLrcIdx(-1); activeLrcIdxRef.current=-1; setMiniLyric('')
    try { if (!currentTrack || !lyricsEnabled) return } catch { return }
    ;(async()=>{
      try {
        const meta = { artist: currentTrack.artist, title: currentTrack.title, duration: currentTrack.duration }
        const l = await window.electronAPI.getLyricsForTrack?.(meta)
        if (l?.syncedLyrics){ const arr = parseLrc(l.syncedLyrics); setParsedLrc(arr); parsedLrcRef.current = arr; setLyricsData(l); if (autoOpenLyrics) setLyricsOpen(true) }
        else { setLyricsData(l||null); setParsedLrc([]); parsedLrcRef.current=[]; if (autoOpenLyrics && (l?.plainLyrics)) setLyricsOpen(true) }
      } catch {}
    })()
  }, [currentTrack, lyricsEnabled])

  // Visualizer draw loop for Theater mode
  useEffect(()=>{
    if (!theaterOn) return
    let raf = 0
    const canvas = document.getElementById('vis')
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx2d = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const resize = ()=>{ canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr }
    resize(); const onRes=()=>resize(); window.addEventListener('resize', onRes)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const draw = ()=>{
      raf = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx2d.clearRect(0,0,canvas.width, canvas.height)
      const bars = 96
      const step = Math.floor(data.length/bars)
      const w = canvas.width/bars
      for (let i=0;i<bars;i++){
        const v = data[i*step]/255
        const h = v * canvas.height*0.6
        ctx2d.fillStyle = `hsl(210 90% ${Math.round(30+v*50)}%)`
        ctx2d.fillRect(i*w, canvas.height-h, w*0.8, h)
      }
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', onRes) }
  }, [theaterOn])
  // Visualizer for Dock
  useEffect(()=>{
    if (!dockVisOn) return
    let raf = 0
    const canvas = document.getElementById('dock-vis')
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx2d = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const resize = ()=>{ canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr }
    resize(); const onRes=()=>resize(); window.addEventListener('resize', onRes)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const draw = ()=>{
      raf = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx2d.clearRect(0,0,canvas.width, canvas.height)
      const bars = 64
      const step = Math.floor(data.length/bars)
      const w = canvas.width/bars
      for (let i=0;i<bars;i++){
        const v = data[i*step]/255
        const h = v * canvas.height*0.6
        ctx2d.fillStyle = `hsl(210 90% ${Math.round(30+v*50)}%)`
        ctx2d.fillRect(i*w, canvas.height-h, w*0.8, h)
      }
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', onRes) }
  }, [dockVisOn])
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); setPaletteOpen(v=>!v) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(()=>{
    const onHotkeys = (e)=>{
      try{
        if (e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.isContentEditable)) return
        const k = e.key.toLowerCase()
        if (k===' '){ e.preventDefault(); togglePlayPause(); return }
        if (k==='k'){ e.preventDefault(); togglePlayPause(); return }
        if (k==='j'){ e.preventDefault(); const el=getActiveEl(); if(el) el.currentTime = Math.max(0, (el.currentTime||0)-5) ; return }
        if (k==='l'){ e.preventDefault(); const el=getActiveEl(); if(el) el.currentTime = Math.min((el.duration||0), (el.currentTime||0)+10) ; return }
        if (k==='arrowleft'){ const el=getActiveEl(); if(el) el.currentTime = Math.max(0, (el.currentTime||0)-5) }
        if (k==='arrowright'){ const el=getActiveEl(); if(el) el.currentTime = Math.min((el.duration||0), (el.currentTime||0)+5) }
        if (k==='arrowup'){ e.preventDefault(); setVolume(v=> Math.min(1, v+0.05)) }
        if (k==='arrowdown'){ e.preventDefault(); setVolume(v=> Math.max(0, v-0.05)) }
      }catch{}
    }
    window.addEventListener('keydown', onHotkeys)
    return ()=> window.removeEventListener('keydown', onHotkeys)
  }, [currentTrack])

  const SectionCard = ({ title, items }) => (
    <div className="bg-surface border border-border rounded p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {(items || []).map((t) => (
          <div key={t.id} className="bg-surface-muted border border-border rounded p-3 flex flex-col gap-2">
            <img alt={t.title} src={t.thumbnail || 'https://via.placeholder.com/300x200/4a9eff/ffffff?text=♫'} className="w-full h-36 object-cover rounded" />
            <div className="text-sm font-medium line-clamp-2">{t.title}</div>
            <div className="text-xs text-muted-foreground">{t.artist} • {t.platform}</div>
            <div className="flex items-center justify-between mt-1">
              <Button className="flex-1" onClick={() => doPlay(t)}>Play</Button>
              <span className="flex items-center gap-2 ml-2">
                <button className="p-1 hover:text-primary" title="Add to queue" onClick={() => addToQueue(t)}><ListPlus size={16}/></button>
                <button className="p-1 hover:text-primary" title="Like" onClick={async () => { const id = await persistTrack(t); if (id) await window.electronAPI.toggleLikeSong?.(id) }}><Heart size={16}/></button>
                <button className="p-1 hover:text-primary" title="Add to playlist" onClick={async () => {
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
                }}><Plus size={16}/></button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const [themeOpen, setThemeOpen] = useState(false)

  function clamp01(n){ return Math.max(0, Math.min(1, n)) }
  function parseHslToObj(hsl){
    try{
      const [h,s,l] = String(hsl).split(/\s+/)
      return { h: Number(h), s: Number(s.replace('%',''))/100, l: Number(l.replace('%',''))/100 }
    }catch{ return null }
  }
  function hslStr(o){ return `${o.h} ${Math.round(o.s*100)}% ${Math.round(o.l*100)}%` }
  function deriveTokens(bgStr, fgStr){
    const bg = parseHslToObj(bgStr) || {h:0,s:0,l:0.04}
    const fg = parseHslToObj(fgStr) || {h:0,s:0,l:1}
    // simple surfaces based on background lightness; tuned for both light/dark
    const isDark = bg.l < 0.5
    const surface = { ...bg, l: clamp01(isDark? bg.l + 0.03 : bg.l - 0.03) }
    const surfaceMuted = { ...bg, l: clamp01(isDark? bg.l + 0.06 : bg.l - 0.06) }
    const border = { ...bg, l: clamp01(isDark? bg.l + 0.12 : bg.l - 0.12) }
    const mutedFg = { ...fg, l: clamp01(isDark? 0.65 : 0.35), s: clamp01(fg.s*0.6) }
    return {
      '--surface': hslStr(surface),
      '--surface-muted': hslStr(surfaceMuted),
      '--border': hslStr(border),
      '--muted-foreground': hslStr(mutedFg),
    }
  }
  function applyThemeVars(vars) {
    const root = document.documentElement
    const bg = vars['--background']
    const fg = vars['--foreground']
    const derived = deriveTokens(bg, fg)
    Object.entries({ ...vars, ...derived }).forEach(([k,v]) => root.style.setProperty(k, v))
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('celes.theme') || 'null')
      if (saved) applyThemeVars(saved)
    } catch {}
  }, [])

  // Artist pages removed per request

  function ThemePanel() {
    const [primary, setPrimary] = useState(getComputedStyle(document.documentElement).getPropertyValue('--primary'))
    const [bg, setBg] = useState(getComputedStyle(document.documentElement).getPropertyValue('--background') || '0 0% 4%')
    const [fg, setFg] = useState(getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '0 0% 100%')
    const [keepOpen, setKeepOpen] = useState(() => { try { return localStorage.getItem('celes.theme.keepOpen')==='true' } catch { return false } })
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
      // Keep panel open if user desires
      if (!keepOpen) setThemeOpen(false)
    }

    return (
      <div className="fixed right-4 top-16 z-50 bg-surface border border-border rounded p-3 w-80 shadow-xl">
        <div className="text-sm font-semibold mb-2 flex items-center justify-between">
          <span>Theme</span>
          <label className="text-[11px] text-muted-foreground flex items-center gap-1"><input type="checkbox" checked={keepOpen} onChange={(e)=>{ const v=e.target.checked; setKeepOpen(v); try{ localStorage.setItem('celes.theme.keepOpen', String(v)) }catch{} }} /> Keep open</label>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="mb-1">Preset</div>
            <select className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={preset} onChange={(e)=>onPreset(e.target.value)}>
              <option value="">Custom…</option>
              {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1">Primary (H S L)</div>
            <input className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={primary} onChange={(e)=>setPrimary(e.target.value)} />
          </div>
          <div>
            <div className="mb-1">Background (H S L)</div>
            <input className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={bg} onChange={(e)=>setBg(e.target.value)} />
          </div>
          <div>
            <div className="mb-1">Foreground (H S L)</div>
            <input className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={fg} onChange={(e)=>setFg(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={save}>Save</Button>
            <Button variant="ghost" onClick={()=>setThemeOpen(false)}>Close</Button>
          </div>
          <div className="pt-2 text-muted-foreground">Tip: presets change HSL variables globally.</div>
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
        <div className="w-[560px] bg-surface border border-border rounded shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <input autoFocus className="w-full bg-surface-muted border-b border-border px-3 py-2 text-sm" placeholder="Type a command…" value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Escape') setPaletteOpen(false)}} />
          <div className="max-h-80 overflow-auto">
            {filtered.map((c,i)=>(
              <div key={i} className="px-3 py-2 text-sm hover:bg-surface-muted cursor-pointer" onClick={()=>{ c.run(); setPaletteOpen(false) }}>{c.name}</div>
            ))}
            {filtered.length===0 && <div className="px-3 py-3 text-xs text-muted-foreground">No commands</div>}
          </div>
        </div>
      </div>
    )
  }

  function DownloadsView(){
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [quota, setQuota] = useState({ used:0, limit: 10*1024*1024*1024 })
    const refresh = async ()=>{ setLoading(true); try { const list = await window.electronAPI.getDownloads?.(); setItems(Array.isArray(list)? list:[]) } finally { setLoading(false) } }
    useEffect(()=>{ refresh() },[])
    const fmt = (n)=>{ if(!Number.isFinite(n)) return '—'; const units=['B','KB','MB','GB','TB']; let i=0; let v=n; while(v>=1024 && i<units.length-1){ v/=1024; i++ } return `${v.toFixed(1)} ${units[i]}` }
    useEffect(()=>{ const used = (items||[]).reduce((s,x)=> s + (x.bytes||0), 0); setQuota(q=>({ ...q, used })) }, [items])
    return (
      <div className="bg-surface border border-border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Downloads</div>
          <div className="text-[11px] text-muted-foreground">{fmt(quota.used)} / {fmt(quota.limit)}</div>
        </div>
        <div className="mb-3 flex gap-2">
          <Button onClick={refresh}>Refresh</Button>
          <Button variant="ghost" onClick={async()=>{
            // Download full library: stream songs only (not already downloaded)
            const all = await window.electronAPI.getStreamingSongs?.()
            const settings = await window.electronAPI.getSettings?.()||{}
            const targetDir = settings.downloadDir || prompt('Download folder')
            if (!targetDir) return
            let count=0
            for (const t of (all||[])){
              try {
                const res = await window.electronAPI.downloadTrack?.({ id:t.stream_id||t.id, stream_id:String(t.stream_id||t.id), platform:t.platform||'youtube', title:t.title, artist:t.artist, streamUrl:t.stream_url }, targetDir)
                if (res && !res.error) count++
              } catch {}
            }
            alert('Downloaded '+count+' tracks')
            refresh()
          }}>Download Full Library</Button>
        </div>
        <div className="space-y-2">
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && items.length===0 && <div className="text-xs text-muted-foreground">No downloads yet</div>}
          {items.map(d => (
            <div key={d.id} className="text-xs flex items-center gap-2 border border-border rounded p-2">
              <div className="flex-1 truncate">{d.title || 'Unknown'} — {d.artist || ''}</div>
              <div className="text-muted-foreground">{fmt(d.bytes)}</div>
              <Button variant="ghost" onClick={async()=>{ await window.electronAPI.deleteDownload?.(d.id, true); refresh() }}>Delete</Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const [paletteOpen, setPaletteOpen] = useState(false)

  function SettingsPanel(){
    return (
      <div className="fixed right-4 top-16 z-50 bg-surface border border-border rounded p-3 w-96 shadow-xl">
        <div className="text-sm font-semibold mb-2">Settings</div>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between"><div>Radio (auto similar)</div><input type="checkbox" checked={radioOn} onChange={(e)=>setRadioOn(e.target.checked)} /></div>
          <div className="flex items-center justify-between"><div>Crossfade</div><input type="checkbox" checked={crossfadeOn} onChange={(e)=>setCrossfadeOn(e.target.checked)} /></div>
          <div>
            <div className="mb-1">Crossfade Duration (ms)</div>
          <input type="number" className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={crossfadeMs} onChange={(e)=>setCrossfadeMs(Number(e.target.value)||0)} />
          </div>
          <div className="flex items-center justify-between"><div>Gapless (preload next)</div><input type="checkbox" checked={gaplessOn} onChange={(e)=>setGaplessOn(e.target.checked)} /></div>
          <div className="flex items-center justify-between"><div>Normalize loudness</div><input type="checkbox" checked={normalizeOn} onChange={(e)=>setNormalizeOn(e.target.checked)} /></div>
          <div>
            <div className="mb-1">Target LUFS</div>
            <input type="number" step={1} min={-30} max={-8} className="w-full bg-surface-muted border border-border rounded px-2 py-1" value={targetLufs} onChange={(e)=>setTargetLufs(Number(e.target.value)||-14)} />
          </div>
          <div className="flex items-center justify-between"><div>Equalizer</div><input type="checkbox" checked={eqOn} onChange={(e)=>{ setEqOn(e.target.checked); if(e.target.checked) ensureAudioGraph(); }} /></div>
          <div className="flex items-center justify-between"><div>Lyrics</div><input type="checkbox" checked={lyricsEnabled} onChange={(e)=>{ const v=e.target.checked; setLyricsEnabled(v); try{ localStorage.setItem('celes.lyricsEnabled', String(v)) }catch{} }} /></div>
          <div className="flex items-center justify-between"><div>Auto open lyrics</div><input type="checkbox" checked={autoOpenLyrics} onChange={(e)=>{ const v=e.target.checked; setAutoOpenLyrics(v); try{ localStorage.setItem('celes.autoOpenLyrics', String(v)) }catch{} }} /></div>
          <div className="flex items-center justify-between"><div>Show mini lyric</div><input type="checkbox" checked={showMiniLyric} onChange={(e)=>{ const v=e.target.checked; setShowMiniLyric(v); try{ localStorage.setItem('celes.showMiniLyric', String(v)) }catch{} }} /></div>
          <div className="flex gap-2 items-center">
            <div>Preset:</div>
            <select className="bg-surface-muted border border-border rounded px-2 py-1" onChange={(e)=>setEqPreset(e.target.value)}>
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
          <div className="h-px bg-border my-2" />
          <div className="text-sm font-semibold">Downloads</div>
          <div className="flex items-center justify-between"><div>Auto-download liked songs</div><input type="checkbox" checked={autoDownloadLiked} onChange={async (e)=>{ const v=e.target.checked; setAutoDownloadLiked(v); await persistSettings({ ...(await window.electronAPI.getSettings?.()||{}), autoDownloadLiked: v, downloadDir }) }} /></div>
          <div>
            <div className="mb-1">Download folder</div>
            <div className="flex gap-2">
              <input className="flex-1 bg-surface-muted border border-border rounded px-2 py-1" value={downloadDir} onChange={(e)=>setDownloadDir(e.target.value)} />
              <Button variant="ghost" onClick={async ()=>{ const dir = prompt('Set download folder', downloadDir || '/Users/'+(navigator.userAgent.includes('Mac')?'eoinfr':'')+'/Music/Celes'); if(dir){ setDownloadDir(dir); await persistSettings({ ...(await window.electronAPI.getSettings?.()||{}), autoDownloadLiked, downloadDir: dir }) } }}>Choose</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  

  useEffect(()=>{ (async()=>{ try { const s = await window.electronAPI.getSettings?.(); if(s){ if(s.autoDownloadLiked!=null) setAutoDownloadLiked(!!s.autoDownloadLiked); if(s.downloadDir) setDownloadDir(s.downloadDir) } } catch {} })() }, [])
  async function persistSettings(next){ try { await window.electronAPI.saveSettings?.(next) } catch {} }

  function makeTrackKey(t){ return `${(t.platform||'youtube')}:${String(t.stream_id||t.id)}` }

  async function queuePlaylistDownload(playlist, onlyMissing){
    try {
      const songs = Array.isArray(playlist?.songs) ? playlist.songs : []
      let candidates = songs.filter(t => (t.type==='stream' || t.platform))
      if (onlyMissing){
        const existing = await window.electronAPI.getDownloads?.()
        const bySongId = new Set((existing||[]).map(d=>d.song_id))
        candidates = candidates.filter(t => !bySongId.has(t.id))
      }
      if (candidates.length===0) { alert('Nothing to download') ; return }
      const settings = await window.electronAPI.getSettings?.()||{}
      const target = settings.downloadDir || prompt('Download folder')
      if (!target) return
      const payload = candidates.map(t=>({ id: t.stream_id||t.id, stream_id: String(t.stream_id||t.id), platform: t.platform||'youtube', title: t.title, artist: t.artist, streamUrl: t.stream_url||t.streamUrl }))
      await window.electronAPI.downloadQueueAdd?.(payload, target)
      const keys = new Set(payload.map(makeTrackKey))
      playlistDlRef.current.set(playlist.id, { keys, total: payload.length, done: 0 })
      setPlaylistDl(prev=>({ ...prev, [playlist.id]: { total: payload.length, done: 0, currentPercent: null } }))
    } catch {}
  }

  useEffect(()=>{
    const handler = (data)=>{
      try{
        if (!data || !data.track) return
        const key = makeTrackKey(data.track)
        for (const [pid, state] of playlistDlRef.current.entries()){
          if (!state?.keys?.has(key)) continue
          if (data.state==='progress'){
            const pct = data.total ? Math.round((data.written||0)/data.total*100) : null
            setPlaylistDl(prev=>({ ...prev, [pid]: { ...(prev[pid]||{ total: state.total, done: state.done }), total: state.total, done: state.done, currentPercent: pct } }))
          }
          if (data.state==='done'){
            state.done = Math.min(state.total, (state.done||0)+1)
            setPlaylistDl(prev=>({ ...prev, [pid]: { total: state.total, done: state.done, currentPercent: 100 } }))
            // if finished all, clear from ref later
          }
        }
      }catch{}
    }
    window.electronAPI.onDownloadProgress?.(handler)
  }, [])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex">
      <Sidebar onSelect={setView} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-surface">
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-surface border border-border flex-1 max-w-3xl">
            <input className="bg-transparent outline-none text-sm w-full" placeholder="Ask for any song, artist, mood…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
            <Button onClick={doSearch} disabled={loading}>{loading ? <span className="inline-flex items-center gap-1"><img src="/assets/icons/celes-star.svg" className="w-4 h-4 animate-spin opacity-80" alt="loading"/> Searching…</span> : 'Search'}</Button>
          </div>
          <Button variant="ghost" onClick={()=>setThemeOpen(v=>!v)}>Theme</Button>
          <Button variant="ghost" onClick={()=>setSettingsOpen(v=>!v)}>Settings</Button>
          <Button variant="ghost" onClick={()=>setMiniDockOn(v=>!v)}>{miniDockOn? 'Hide Dock':'Dock'}</Button>
          <div className="md:hidden flex-1" />
        </header>

        <main className="flex-1 grid lg:grid-cols-[1fr_320px_340px] md:grid-cols-[1fr_320px] gap-4 p-4 pb-28">
          <section className="space-y-3">
            {view === 'home' && (
              <>
                {homeLoading && (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {Array.from({length: 6}).map((_,i)=> (
                      <div key={`home_sk_${i}`} className="bg-surface border border-border rounded p-3 animate-pulse">
                        <div className="w-full h-36 rounded bg-surface-muted" />
                        <div className="h-4 mt-2 w-3/4 bg-surface-muted rounded" />
                        <div className="h-3 mt-1 w-1/2 bg-surface-muted rounded" />
                      </div>
                    ))}
                  </div>
                )}
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
                {!results.length && <div className="text-sm text-muted-foreground">Type anything – e.g. “calming piano at night”, “vocal jazz 50s”, “beethoven sonata 14”.</div>}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {loading && Array.from({length: 8}).map((_,i)=> (
                <div key={`sk_${i}`} className="bg-surface border border-border rounded p-3 animate-pulse">
                  <div className="w-full h-36 rounded bg-surface-muted" />
                  <div className="h-4 mt-2 w-3/4 bg-surface-muted rounded" />
                  <div className="h-3 mt-1 w-1/2 bg-surface-muted rounded" />
                </div>
              ))}
              {!loading && results.map((t) => (
                <div key={t.id} className="bg-surface border border-border rounded p-3 flex flex-col gap-2">
                  <img alt={t.title} src={t.thumbnail || 'https://via.placeholder.com/300x200/4a9eff/ffffff?text=♫'} className="w-full h-36 object-cover rounded" />
                  <div className="text-sm font-medium line-clamp-2">{t.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span><button className="underline" onClick={()=>loadArtist(t.artist)}>{t.artist}</button> • {t.platform}</span>
                        <span className="flex items-center gap-2">
                          <button className="p-1 hover:text-primary" title="Add to queue" onClick={() => addToQueue(t)}><ListPlus size={16}/></button>
                          <button className="p-1 hover:text-primary" title="Like" onClick={async () => { const id = await persistTrack(t); if (id) await window.electronAPI.toggleLikeSong?.(id) }}><Heart size={16}/></button>
                          <button className="p-1 hover:text-primary" title="Add to playlist" onClick={async () => {
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
                          }}><Plus size={16}/></button>
                        </span>
                      </div>
                      <div className="mt-1">
                        <Button className="w-full" onClick={() => doPlay(t)}>Play</Button>
                      </div>
                      {/* Trimmed action set in Spotify-like compact row */}
                      {/* Removed Import button as requested */}
                      {/* Removed duplicate +Queue and ♥ buttons in favor of icon row */}
                      {/* Keep Radio action minimal */}
                      <div className="hidden">
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
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Artist view removed */}
            {view === 'downloads' && (
              <DownloadsView />
            )}
          </section>

          <aside className="hidden md:flex flex-col gap-3">
            <div className="bg-surface border border-border rounded p-3">
              <div className="text-sm font-semibold mb-2">Queue</div>
              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {queue.length === 0 && <div className="text-xs text-muted-foreground">Queue is empty</div>}
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
            <div className="bg-surface border border-border rounded p-3">
              <div className="text-sm font-semibold mb-2">Now playing</div>
              <audio id="audio-el" ref={audioRef} controls className="w-full" preload="auto" crossOrigin="anonymous" />
              <audio id="audio-next" ref={nextAudioRef} className="hidden" preload="metadata" crossOrigin="anonymous" />
            </div>
            <div className="bg-surface border border-border rounded p-3">
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
                  <div key={p.id} className={`border rounded p-2 ${activePlaylistId===p.id?'border-primary':'border-border'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-surface-muted overflow-hidden flex items-center justify-center">
                          {playlistCovers[p.id] ? <img src={playlistCovers[p.id]} alt="cover" className="w-full h-full object-cover"/> : <span className="text-[10px] text-muted-foreground">★</span>}
                        </div>
                    <div className="text-xs font-medium truncate">{p.name} <span className="text-muted-foreground">({p.songs?.length || 0})</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => setActivePlaylistId(p.id)}>Open</Button>
                        <Button variant="ghost" onClick={async () => { queuePlaylistDownload(p, false) }}>Download</Button>
                        <Button variant="ghost" onClick={async () => { queuePlaylistDownload(p, true) }}>Download Missing</Button>
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
                        {(p.songs?.length || 0) === 0 && <div className="text-xs text-muted-foreground">No tracks yet</div>}
                        {(p.songs || []).map((t, idx) => (
                          <div key={`${t.id}_${idx}`} className="text-xs flex items-center gap-2">
                            <img src={t.thumbnail_url || t.thumbnail || 'https://via.placeholder.com/28'} className="w-7 h-7 rounded object-cover"/>
                            <div className="flex-1 truncate">{t.title}</div>
                            <Button variant="ghost" onClick={() => doPlay({ ...t, platform: t.platform || t.type === 'stream' ? t.platform : 'internetarchive' })}>Play</Button>
                          </div>
                        ))}
                        {playlistDl[p.id] && (
                          <div className="text-[11px] text-muted-foreground">Downloading: {playlistDl[p.id].done}/{playlistDl[p.id].total}{playlistDl[p.id].currentPercent!=null? ` • ${playlistDl[p.id].currentPercent}%`:''}</div>
                        )}
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
      {miniDockOn && (
        <div className="fixed bottom-24 right-4 z-40 bg-surface/95 border border-border rounded shadow-xl p-3 w-[340px]">
          <div className="text-sm font-semibold mb-2 flex items-center justify-between">
            <span>Mini Dock</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={dockVisOn} onChange={(e)=>setDockVisOn(e.target.checked)} /> Vis</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={dockVideoOn} onChange={async (e)=>{
                const on = e.target.checked
                setDockVideoOn(on)
                if (on) {
                  try {
                    // Turn off visualizer when enabling video
                    setDockVisOn(false)
                    setDockVideoFailed(false)
                    let vid = deriveYouTubeId(currentTrack)
                    if (!vid && currentTrack){
                      const q = [currentTrack.artist, currentTrack.title].filter(Boolean).join(' ')
                      const found = await window.electronAPI.searchMusicWithFallback?.(q, 'youtube', 3)
                      const cand = Array.isArray(found) ? found.find(x=> String(x?.id||'').length===11) : null
                      if (cand) vid = String(cand.id).slice(0,11)
                    }
                    if (!vid) { setDockVideoOn(false); return }
                    setDockVideoId(vid)
                    const res = await window.electronAPI.getYouTubeVideoStream?.(vid)
                    const url = res?.streamUrl
                    if (!url) { setDockVideoOn(false); return }
                    const proxy = `celes-stream://proxy?u=${encodeURIComponent(url)}`
                    setDockVideoUrl(proxy)
                    // Proactively load and play
                    setTimeout(()=>{ try { if (dockVideoRef.current) { dockVideoRef.current.src = proxy; dockVideoRef.current.load(); dockVideoRef.current.play().catch(()=>{}) } } catch {} }, 0)
                  } catch { setDockVideoOn(false) }
                } else {
                  setDockVideoUrl(null)
                  try { if (dockVideoRef.current) { dockVideoRef.current.pause(); dockVideoRef.current.src = '' } } catch {}
                }
              }} /> Video</label>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <img src={currentTrack?.thumbnail || 'https://via.placeholder.com/48'} className="w-12 h-12 rounded object-cover"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{currentTrack?.title || 'Nothing playing'}</div>
              <div className="text-xs text-muted-foreground truncate">{currentTrack?.artist || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>nextFromQueue()}><SkipBack size={16}/></button>
              <button className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlayPause}>{isPlaying? <Pause size={16}/> : <Play size={16}/>}</button>
              <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>nextFromQueue()}><SkipForward size={16}/></button>
            </div>
          </div>
          {(dockVisOn || dockVideoOn) && (
            <div className="mt-2 rounded overflow-hidden border border-border bg-black/60" style={{height: 120}}>
              {dockVideoOn ? (
                dockVideoUrl && !dockVideoFailed ? (
                  <video ref={dockVideoRef} src={dockVideoUrl||''} className="w-full h-full object-contain bg-black" muted playsInline autoPlay crossOrigin="anonymous" onError={()=>setDockVideoFailed(true)} onCanPlay={()=>{ try { dockVideoRef.current?.play?.() } catch {} }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Video unavailable</div>
                )
              ) : (
                <canvas id="dock-vis" className="w-full h-full" />
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e)=>setVolume(Number(e.target.value))} className="flex-1 accent-primary" />
            <button className="text-xs text-muted-foreground" onClick={()=>setMiniDockOn(false)}>Close</button>
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-screen-2xl px-4 h-20 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 bg-surface-muted rounded overflow-hidden flex items-center justify-center">
              {currentTrack ? (<img alt={currentTrack.title} src={currentTrack.thumbnail || 'https://via.placeholder.com/56'} className="w-full h-full object-cover" />) : (<span className="text-xs text-muted-foreground">♫</span>)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate max-w-[220px]">{currentTrack?.title || 'Nothing playing'}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[220px]">{currentTrack?.artist || ''}</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1 items-center">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded hover:bg-surface-muted" onClick={previousOrRestart} aria-label="Previous"><SkipBack size={18} /></button>
              <button className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlayPause} aria-label="Play/Pause">{isPlaying ? <Pause size={18}/> : <Play size={18}/>}</button>
              <button className="p-2 rounded hover:bg-surface-muted" onClick={() => nextFromQueue()} aria-label="Next"><SkipForward size={18} /></button>
            </div>
            <div className="flex items-center gap-3 w-full max-w-xl">
              <span className="text-[11px] text-muted-foreground w-10 text-right">{fmtTime(progress)}</span>
              <input type="range" min={0} max={Math.max(1, duration)} step="any" value={Math.min(progress, duration || 0)}
                onMouseDown={()=>{ isSeekingRef.current = true; const el = getActiveEl(); if(el) try{ el.pause() }catch{} }}
                onChange={(e) => { const t = Number(e.target.value); setProgress(t) }}
                onMouseUp={(e)=>{ const t = Number(e.currentTarget.value); const el = getActiveEl(); if (el){ if (typeof el.fastSeek === 'function'){ try { el.fastSeek(t) } catch { el.currentTime = t } } else { el.currentTime = t } el.play().catch(()=>{}) } isSeekingRef.current = false }}
                className="w-full accent-primary" />
              <span className="text-[11px] text-muted-foreground w-10">{fmtTime(duration)}</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 w-48 justify-end">
            <button className="p-2 rounded hover:bg-surface-muted" onClick={() => setVolume(v => v > 0 ? 0 : 0.8)} aria-label="Mute">{volume > 0 ? <Volume2 size={18}/> : <VolumeX size={18}/>} </button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32 accent-primary" />
            {showMiniLyric && miniLyric && <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{miniLyric}</div>}
            <Button variant="ghost" onClick={async()=>{ if(!currentTrack) return; setLyricsOpen(v=>!v); if(!lyricsData){ setLyricsData({ loading:true }); const meta = { artist: currentTrack.artist, title: currentTrack.title, duration: currentTrack.duration }; const l = await window.electronAPI.getLyricsForTrack?.(meta); setLyricsData(l||{plainLyrics:'No lyrics found'}); } }}>Lyrics</Button>
            <Button variant="ghost" onClick={()=>setTheaterOn(true)}>Theater</Button>
          </div>
        </div>
      </div>
      {lyricsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={()=>setLyricsOpen(false)}>
          <div className="w-[640px] max-h-[70vh] overflow-auto bg-surface border border-border rounded p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="text-sm font-semibold mb-2">Lyrics</div>
            {!lyricsData && <div className="text-xs text-muted-foreground">Loading…</div>}
            {lyricsData?.syncedLyrics ? (
              <div className="text-sm leading-7">
                {(parsedLrc||[]).map((line,idx)=> (
                  <div key={idx} id={`lrc-line-${idx}`} className={idx===activeLrcIdx? 'text-primary font-semibold' : 'text-foreground/80'}>
                    {line.text}
                  </div>
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-foreground/80">{lyricsData?.plainLyrics || 'No lyrics found'}</pre>
            )}
            <div className="text-[11px] text-muted-foreground mt-2">Source: {lyricsData?.source || '—'}</div>
            <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={()=>setLyricsOpen(false)}>Close</Button></div>
          </div>
        </div>
      )}
      {theaterOn && (
        <div className="fixed inset-0 z-50 bg-black">
          {!videoOn && <canvas id="vis" className="absolute inset-0 opacity-40" />}
          {videoOn && (
            <video ref={videoRef} src={videoUrl||''} className="absolute inset-0 w-full h-full object-contain bg-black" controls={false} muted playsInline autoPlay onCanPlay={()=>{ try { videoRef.current?.play?.() } catch {} }} />
          )}
          <div className="relative h-full w-full flex flex-col items-center justify-center gap-6" onClick={(e)=>e.stopPropagation()}>
            <div className="absolute top-4 right-4 flex gap-2">
              <Button variant="ghost" onClick={()=>setTheaterOn(false)}>Exit</Button>
              <Button variant="ghost" onClick={async ()=>{
                try {
                  if (!videoOn) {
                    let vid = deriveYouTubeId(currentTrack)
                    if (!vid) {
                      // Fallback: search YouTube for this track
                      const q = [currentTrack?.artist, currentTrack?.title].filter(Boolean).join(' ')
                      const found = await window.electronAPI.searchMusicWithFallback?.(q, 'youtube', 3)
                      const cand = Array.isArray(found) ? found.find(x=> String(x?.id||'').length===11) : null
                      if (cand) vid = String(cand.id).slice(0,11)
                    }
                    if (!vid) { alert('No YouTube video found for this track'); return }
                    const res = await window.electronAPI.getYouTubeVideoStream?.(vid)
                    const url = res?.streamUrl
                    if (!url) { alert('No video stream available'); return }
                    setVideoUrl(`celes-stream://proxy?u=${encodeURIComponent(url)}`)
                    setVideoOn(true)
                  } else {
                    setVideoOn(false)
                    setVideoUrl(null)
                    const el = videoRef.current; if (el) { try { el.pause() } catch {}; el.src=''; }
                  }
                } catch {}
              }}>{videoOn? 'Hide Video' : 'Show Video'}</Button>
            </div>
            {!videoOn && <img src={currentTrack?.thumbnail || 'https://via.placeholder.com/512'} className="w-[36vmin] h-[36vmin] rounded shadow-lg object-cover" alt="art" />}
            <div className="text-3xl font-bold text-white max-w-[80vw] text-center truncate">{currentTrack?.title||'Nothing playing'}</div>
            <div className="text-lg text-foreground/80 truncate max-w-[70vw]">{currentTrack?.artist||''}</div>
            <div className="flex items-center gap-6">
              <button className="px-5 py-3 rounded bg-white/10 hover:bg-white/20 text-white" onClick={togglePlayPause}>{isPlaying? 'Pause':'Play'}</button>
              <button className="px-5 py-3 rounded bg-white/10 hover:bg-white/20 text-white" onClick={()=>nextFromQueue()}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



