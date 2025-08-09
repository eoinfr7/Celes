import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Plus, ListPlus, Pencil, Trash2, ChevronRight, ArrowUp, ArrowDown, Download } from 'lucide-react'

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
  // view already defined earlier
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTrack, setPickerTrack] = useState(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null) // { id, name }
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false)

  const [currentTrack, setCurrentTrack] = useState(null)
  const [likedSet, setLikedSet] = useState(()=>{ try { return new Set(JSON.parse(localStorage.getItem('celes.likedSet')||'[]')) } catch { return new Set() } })
  const [likedSongs, setLikedSongs] = useState([])
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
  const [dockVisOn, setDockVisOn] = useState(()=>{ try{ return localStorage.getItem('celes.dockVisOn')==='true' }catch{ return false } })
  // Mini window mode (native window loads app with ?mini=1) – render compact UI and control main via IPC
  const isMiniMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mini') === '1'
  const [miniNow, setMiniNow] = useState(null)

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

  function IconButton({ title, children, onClick, className='' }){
    return (
      <button title={title}
              className={`p-2 rounded hover:bg-surface-muted border border-transparent focus-visible:outline-none ${className}`}
              onClick={onClick}>
        {children}
      </button>
    )
  }

  // WebAudio EQ
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const normalizeGainRef = useRef(null)
  const analyserRef = useRef(null)
  const filtersRef = useRef([])
  const crossfadeTimerRef = useRef(null)
  const crossfadeGenRef = useRef(0)
  const [eqOn, setEqOn] = useState(()=>{ try{ return localStorage.getItem('celes.eqOn')==='true' }catch{ return false } })
  const [eqGains, setEqGains] = useState(()=>{ try{ const raw=localStorage.getItem('celes.eqGains'); const arr=raw? JSON.parse(raw): null; return Array.isArray(arr)&&arr.length===10? arr : [0,0,0,0,0,0,0,0,0,0] }catch{ return [0,0,0,0,0,0,0,0,0,0] } })
  const [eqQ, setEqQ] = useState(()=>{ try{ const raw=localStorage.getItem('celes.eqQ'); const arr=raw? JSON.parse(raw): null; return Array.isArray(arr)&&arr.length===10? arr : new Array(10).fill(1.1) }catch{ return new Array(10).fill(1.1) } })
  const [eqOpen, setEqOpen] = useState(false)
  const [eqMode, setEqMode] = useState(()=>{ try{ return localStorage.getItem('celes.eqMode') || 'Expert' }catch{ return 'Expert' } })
  const [visRidgeOn, setVisRidgeOn] = useState(()=>{ try{ const v = localStorage.getItem('celes.visRidgeOn'); return v==null? true : v==='true' }catch{ return true } })
  const [visRidgeDecay, setVisRidgeDecay] = useState(()=>{ try{ const v = Number(localStorage.getItem('celes.visRidgeDecay')); return Number.isFinite(v)? v : 0.7 }catch{ return 0.7 } })
  const [visSlope, setVisSlope] = useState(()=>{ try{ const v = Number(localStorage.getItem('celes.visSlope')); return Number.isFinite(v)? v : 3 }catch{ return 3 } })
  const [visSmooth, setVisSmooth] = useState(()=>{ try{ const v = Number(localStorage.getItem('celes.visSmooth')); return Number.isFinite(v)? v : 2 }catch{ return 2 } })
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
    const filters = EQ_BANDS.map((freq, i)=>{ const f=ctx.createBiquadFilter(); f.type='peaking'; f.frequency.value=freq; f.Q.value=Number(eqQ[i]||1.1); f.gain.value=Number(eqGains[i]||0); return f })
    // chain: src -> norm -> filters... -> dest
    src.connect(norm)
    norm.connect(filters[0])
    for (let i=0;i<filters.length-1;i++) filters[i].connect(filters[i+1])
    const last = filters[filters.length-1]
    last.connect(ctx.destination)
    // visualizer analyser (tap)
    let analyser = analyserRef.current
    if (!analyser) {
      analyser = ctx.createAnalyser()
      analyserRef.current = analyser
    }
    analyser.fftSize = 4096
    analyser.smoothingTimeConstant = 0.85
    last.connect(analyser)
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
    try{ localStorage.setItem('celes.eqGains', JSON.stringify(gains)) }catch{}
  }

  function applyEqQ(qs){
    filtersRef.current.forEach((f,i)=>{ try{ f.Q.value = qs[i]||1.1 }catch{}})
    try{ localStorage.setItem('celes.eqQ', JSON.stringify(qs)) }catch{}
  }

  // Preset save/A-B slots in local storage for quick auditioning
  const [presetName, setPresetName] = useState(()=>{ try { return localStorage.getItem('celes.eqPresetName') || 'Custom' } catch { return 'Custom' } })
  function saveCurrentPreset(name){
    try {
      localStorage.setItem('celes.eqPresetName', name||'Custom')
      localStorage.setItem('celes.eqPresetGains', JSON.stringify(eqGains))
      localStorage.setItem('celes.eqPresetQ', JSON.stringify(eqQ))
      setPresetName(name||'Custom')
    } catch {}
  }
  function recallPreset(slot){
    try {
      const g = JSON.parse(localStorage.getItem(`celes.eqAB_${slot}_g`)||'[]')
      const q = JSON.parse(localStorage.getItem(`celes.eqAB_${slot}_q`)||'[]')
      if (Array.isArray(g) && g.length===10) { setEqGains(g); applyEqGains(g) }
      if (Array.isArray(q) && q.length===10) { setEqQ(q); applyEqQ(q) }
    } catch {}
  }
  function storePreset(slot){
    try { localStorage.setItem(`celes.eqAB_${slot}_g`, JSON.stringify(eqGains)); localStorage.setItem(`celes.eqAB_${slot}_q`, JSON.stringify(eqQ)) } catch {}
  }

  // Apply/clear EQ when toggled
  useEffect(()=>{
    try{
      if (!audioCtxRef.current || !filtersRef.current?.length) ensureAudioGraph()
      if (eqOn) applyEqGains(eqGains)
      else applyEqGains(new Array(10).fill(0))
    }catch{}
  }, [eqOn])

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
    // cancel any previous fade
    if (crossfadeTimerRef.current){ try { clearInterval(crossfadeTimerRef.current) } catch {} ; crossfadeTimerRef.current = null }
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
    // Immediately switch the logical active side so UI (time/duration/seek) follows the audible track
    setActiveSide(prev => prev === 'main' ? 'next' : 'main')
    setIsPlaying(true)
    const gen = ++crossfadeGenRef.current
    // Force refresh of duration/progress for the new active element ASAP
    try {
      setTimeout(()=>{
        if (gen !== crossfadeGenRef.current) return
        const el = getActiveEl()
        if (el){ setDuration(el.duration || 0); setProgress(el.currentTime || 0) }
      }, 0)
    } catch {}
    const useMs = Number.isFinite(fadeMs) ? Math.max(50, fadeMs) : crossfadeMs
    const steps = Math.max(6, Math.floor(useMs/40))
    const step = useMs/steps
    let i=0
    const timer = setInterval(()=>{
      if (gen !== crossfadeGenRef.current){ clearInterval(timer); return }
      i++
      const t = i/steps
      a.volume = Math.max(0, 1-t)
      b.volume = Math.min(1, t)
      if (i>=steps){
        clearInterval(timer)
        try { a.pause() } catch {}
        try { a.src='' } catch {}
        a.volume=1; b.volume=1
        // already switched sides above
        crossfadeTimerRef.current = null
      }
    }, step)
    crossfadeTimerRef.current = timer
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
  const [chartsYT, setChartsYT] = useState([]) // deprecated; retained only to avoid crashes if referenced
  const [followedFeed, setFollowedFeed] = useState([])
  const [explore, setExplore] = useState(null)
  const [exploreHistory, setExploreHistory] = useState([])
  const [homeLoading, setHomeLoading] = useState(false)
  const [chartsDate, setChartsDate] = useState('')

  async function loadHome() {
    setHomeLoading(true)
    try {
      setDailyMix([])
      const ex = await window.electronAPI.getExploreSections?.()
      setExplore(ex || {})
      const buckets = Array.isArray(ex?.historyBuckets) ? ex.historyBuckets : []
      setExploreHistory(buckets)
      setChartsSC([])
      setFollowedFeed([])
      setChartsDate(new Date().toLocaleDateString())
    } finally { setHomeLoading(false) }
  }

  async function doSearch() {
    setView('search')
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
    // Intelligent fallback: if primary resolution failed, try re-searching quickly by title+artist and pick first playable (short-circuited)
    if (!src) {
      try {
        const q = [track.artist, track.title].filter(Boolean).join(' ')
        const alts = await window.electronAPI.searchMusicWithFallback(q, 'youtube', 3)
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
    // Reset UI timers immediately to avoid showing 0:00 on the wrong element
    try { setProgress(0); setDuration(0) } catch {}
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
  function openPlaylistPickerForTrack(track){ setPickerTrack(track); setPickerOpen(true) }

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
    try {
      const existing = new Set((playlists||[]).map(p=> (p.name||'').toLowerCase()))
      let base = String(name||'').trim() || `Playlist ${playlists.length+1}`
      let attempt = base
      let i = 2
      while (existing.has(attempt.toLowerCase())) { attempt = `${base} ${i++}` }
      let res = await window.electronAPI.createPlaylist?.(attempt)
      if (!res?.playlistId && res?.error) {
        // One more fallback with timestamp to guarantee uniqueness
        attempt = `${base} ${Date.now()%100000}`
        res = await window.electronAPI.createPlaylist?.(attempt)
      }
    await reloadPlaylists();
      let pid = res?.playlistId || null
      if (!pid) {
        // Resolve by name if IPC didn't return id
        const fresh = await window.electronAPI.getPlaylists?.()
        const found = (fresh||[]).find(p=> String(p.name).toLowerCase() === attempt.toLowerCase())
        if (found?.id) pid = found.id
      }
      if (pid) {
        // Optimistically reflect in UI immediately
        setPlaylists(prev => {
          const exists = (prev||[]).some(p=> p.id === pid)
          if (exists) return prev
          return [...(prev||[]), { id: pid, name: attempt, type: 'user', songs: [] }]
        })
        setActivePlaylistId(pid)
        setView('playlist')
      }
      return res
    } catch {
      return { success:false }
    }
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
  const [view, setView] = useState('home')

  function openPlaylistPage(pid){ setActivePlaylistId(pid); setView('playlist') }

  function normalizeTrackForPlayback(t){
    return {
      id: t.stream_id || t.id,
      platform: t.platform || (t.type === 'stream' ? (t.platform||'youtube') : 'internetarchive'),
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnail_url || t.thumbnail,
      streamUrl: t.stream_url || t.streamUrl,
      type: t.type || 'stream'
    }
  }

  async function playAllFromPlaylist(pid){
    const pl = playlists.find(p=>p.id===pid) || activePlaylist
    if (!pl) return
    const tracks = (pl.songs||[]).map(normalizeTrackForPlayback)
    if (tracks.length===0) return
    setQueue([])
    await doPlay(tracks[0], { fadeMs: 150 })
    setQueue(tracks.slice(1))
  }

  function queueAllFromPlaylist(pid){
    const pl = playlists.find(p=>p.id===pid) || activePlaylist
    if (!pl) return
    const tracks = (pl.songs||[]).map(normalizeTrackForPlayback)
    if (tracks.length===0) return
    setQueue(q => [...q, ...tracks])
  }

  const isSwitchingRef = useRef(false)
  function nextFromQueue() {
    if (isSwitchingRef.current) return
    const q = queue
    if (!q || q.length === 0) { setIsPlaying(false); return }
    isSwitchingRef.current = true
      const [next, ...rest] = q
    setQueue(rest)
    // Preempt: bump generation to cancel any in-flight fades and start fresh
    crossfadeGenRef.current++
    Promise.resolve().then(async ()=>{ try { await doPlay(next, { fadeMs: 250 }) } finally { isSwitchingRef.current = false } })
  }

  function previousOrRestart() {
    const a = getActiveEl()
    if (!a) return
    if ((a.currentTime || 0) > 3) { try { a.currentTime = 0 } catch {} ; return }
    // No full history stack; replay currentTrack or do nothing
    if (currentTrack) { void doPlay(currentTrack, { fadeMs: 150 }) }
  }

  function togglePlayPause() {
    // If nothing is loaded, don't try to play the empty element. If we have a queue, start it.
    const hasTrack = !!currentTrackRef.current
    const q = queueRef.current || []
    if (!hasTrack) {
      if (q.length > 0) {
        const [next, ...rest] = q
        setQueue(rest)
        void doPlay(next, { fadeMs: 150 })
      }
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play().then(() => setIsPlaying(true)).catch(() => {}) } else { audio.pause(); setIsPlaying(false) }
  }

  function fmtTime(s) { if (!Number.isFinite(s) || s < 0) return '0:00'; const m=Math.floor(s/60); const ss=Math.floor(s%60).toString().padStart(2,'0'); return `${m}:${ss}` }

  useEffect(() => { if (view === 'home') loadHome() }, [view])
  useEffect(() => {
    const onReady = () => { if (view === 'home') loadHome() }
    try { window.electronAPI?.onHandlersReady?.(onReady) } catch {}
    // Prevent accidental zoom/scroll-zoom that causes sluggish canvas perf
    try { window.electronAPI.lockZoom?.() } catch {}
    return () => { /* ipc listener cleaned by Electron on reload */ }
  }, [view])
  useEffect(() => { reloadPlaylists() }, [])
  useEffect(() => { (async()=>{ try { const liked = await window.electronAPI.getLikedSongs?.(); if (Array.isArray(liked)) { setLikedSongs(liked); const keys = liked.map(t=> `${t.platform||'youtube'}:${String(t.stream_id||t.id)}`); setLikedSet(new Set(keys)); try{ localStorage.setItem('celes.likedSet', JSON.stringify(keys)) }catch{} } } catch {} })() }, [])

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
  }, [activeSide, volume, currentTrack])

  useEffect(() => { try { localStorage.setItem('celes.volume', String(volume)) } catch {} ; try { if (audioRef.current) audioRef.current.volume = volume } catch {}; try { if (nextAudioRef.current) nextAudioRef.current.volume = volume } catch {} }, [volume])
  useEffect(() => { window.electronAPI.streamingHealthCheck?.() }, [])
  // Register global media keys so hardware keys work even when window is hidden
  useEffect(() => {
    try { window.electronAPI.registerMediaKeys?.() } catch {}
    return () => { try { window.electronAPI.unregisterMediaKeys?.() } catch {} }
  }, [])

  // System media controls (Media Session API)
  useEffect(() => {
    try {
      if (!('mediaSession' in navigator)) return
      const ms = navigator.mediaSession
      const setMeta = () => {
        try {
          const artwork = currentTrack?.thumbnail ? [{ src: currentTrack.thumbnail, sizes: '512x512', type: 'image/png' }] : []
          ms.metadata = new window.MediaMetadata({
            title: currentTrack?.title || 'Celes',
            artist: currentTrack?.artist || '',
            album: 'Celes',
            artwork,
          })
        } catch {}
      }
      setMeta()
      ms.setActionHandler?.('play', () => { try { const el=getActiveEl(); if(el&&el.paused){ el.play().then(()=>setIsPlaying(true)).catch(()=>{}) } } catch {} })
      ms.setActionHandler?.('pause', () => { try { const el=getActiveEl(); if(el&&!el.paused){ el.pause(); setIsPlaying(false) } } catch {} })
      ms.setActionHandler?.('previoustrack', () => { try { previousOrRestart() } catch {} })
      ms.setActionHandler?.('nexttrack', () => { try { nextFromQueue() } catch {} })
      ms.setActionHandler?.('seekto', (e) => { try { const el = getActiveEl(); if (el && e.seekTime != null) { el.currentTime = Math.max(0, Math.min(el.duration||0, e.seekTime)); } } catch {} })
    } catch {}
  }, [currentTrack])

  // Keep OS position state fresh for scrubbing on control center/SMTC
  useEffect(() => {
    try {
      if (!('mediaSession' in navigator)) return
      const ms = navigator.mediaSession
      const el = getActiveEl()
      if (!el) return
      ms.playbackState = isPlaying ? 'playing' : 'paused'
      if (Number.isFinite(duration)) {
        ms.setPositionState?.({ duration: Number(duration)||0, playbackRate: el.playbackRate||1, position: Number(progress)||0 })
      }
    } catch {}
  }, [isPlaying, progress, duration, activeSide])
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
        if (payload.type === 'previous') { previousOrRestart() }
        if (payload.type === 'seek' && payload.args && typeof payload.args.time === 'number') {
          const el = getActiveEl(); if (el) { try { el.currentTime = Math.max(0, Math.min((el.duration||0), payload.args.time)) } catch {} }
        }
        if (payload.type === 'set-volume' && payload.args && typeof payload.args.volume === 'number') {
          const v = Math.max(0, Math.min(1, payload.args.volume)); setVolume(v)
        }
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
  // Dock Spectrum 2D Canvas visualizer (stable baseline) – we'll upgrade shader polish after
  useEffect(()=>{
    if (!dockVisOn) return
    let raf = 0
    const canvas = document.getElementById('dock-vis')
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const resize = ()=>{ canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr }
    resize(); const onRes=()=>resize(); window.addEventListener('resize', onRes)
    analyser.fftSize = 4096
    const freqBins = analyser.frequencyBinCount
    const data = new Uint8Array(freqBins)
    // Cache log mapping
    const minHz = 20, maxHz = 20000
    const nyquist = (audioCtxRef.current?.sampleRate||44100)/2
    const hzPerBin = nyquist / freqBins
    const logX = (hz)=> Math.log10(hz/minHz) / Math.log10(maxHz/minHz)
    const toDb = (v)=> 20 * Math.log10(Math.max(1e-4, v/255))
    const gridDb = [-12,-24,-36,-48,-60,-72,-84,-96]
    // Theme-driven color palette
    const root = getComputedStyle(document.documentElement)
    const primaryRaw = root.getPropertyValue('--primary').trim() || '265 89% 78%'
    const [ph] = primaryRaw.split(/\s+/)
    const baseHue = Number(ph)||265
    const lineGrad = ctx.createLinearGradient(0,0,canvas.width,0)
    const hueSteps = [baseHue-40, baseHue-10, baseHue+15, baseHue+40, baseHue+65]
    ;[0,0.25,0.5,0.75,1].forEach((stop,i)=>{
      const h = ((hueSteps[i]%360)+360)%360
      lineGrad.addColorStop(stop, `hsla(${h} 100% 75% / 0.95)`)
    })
    const fillGrad = ctx.createLinearGradient(0,0,0,canvas.height)
    fillGrad.addColorStop(0, `hsla(${baseHue} 98% 70% / 0.35)`)
    fillGrad.addColorStop(1, `hsla(${baseHue} 90% 55% / 0.06)`)
    let hoverX = -1
    const onMove = (e)=>{ const rect = canvas.getBoundingClientRect(); hoverX = (e.clientX - rect.left) * dpr }
    const onLeave = ()=>{ hoverX = -1 }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    // peak-hold ridge
    let peakHold = new Float32Array(canvas.width).fill(Number.POSITIVE_INFINITY)
    const decay = visRidgeDecay // px per frame downward
    const slopeDbPerOct = isPlaying ? visSlope : 0 // tilt only when playing
    function yForDb(db){ return canvas.height * (1 - (Math.min(0, db)+100)/100) }
    const draw = ()=>{
      raf = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx.clearRect(0,0,canvas.width, canvas.height)
      // background grid
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      for (const db of gridDb){
        const y = yForDb(db)
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke()
      }
      const decade = [20,50,100,200,500,1000,2000,5000,10000,20000]
      for (const hz of decade){
        const x = Math.round(logX(hz) * canvas.width)
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke()
      }
      ctx.restore()
      // spectrum path
      const path = new Path2D()
      const baseY = canvas.height
      path.moveTo(0, baseY)
      const binsPerPx = []
      const smoothWindow = Math.max(0, Math.round(visSmooth)) // bins on each side
      for (let px=0; px<canvas.width; px++){
        const hz = minHz * Math.pow(10, (px/canvas.width) * Math.log10(maxHz/minHz))
        const bin = Math.min(freqBins-1, Math.max(0, Math.round(hz / hzPerBin)))
        binsPerPx[px] = bin
        // smoothing
        let sum=0; let count=0
        for (let k=-smoothWindow;k<=smoothWindow;k++){ const idx=Math.min(freqBins-1, Math.max(0, bin+k)); sum+=data[idx]; count++ }
        const v = sum/count
        // slope compensation (approx per oct)
        const oct = Math.log2(hz/minHz)
        let db = isPlaying ? (toDb(v) + slopeDbPerOct*oct*-1) : -100
        const y = yForDb(db)
        if (px===0) path.lineTo(px, y)
        else path.lineTo(px, y)
        // update peak hold ridge
        if (isPlaying){
          const current = y
          const prev = peakHold[px]
          peakHold[px] = Math.min(current, (prev===Number.POSITIVE_INFINITY? current : prev + decay))
        } else {
          peakHold[px] = yForDb(-100)
        }
      }
      path.lineTo(canvas.width, baseY)
      path.closePath()
      ctx.fillStyle = fillGrad
      ctx.fill(path)
      ctx.strokeStyle = lineGrad
      ctx.lineWidth = 2.2
      ctx.shadowColor = 'rgba(0,0,0,0.0)'
      ctx.stroke(path)
      ctx.shadowBlur = 0
      // ridge line
      if (visRidgeOn && isPlaying){
        ctx.beginPath()
        for (let px=0; px<canvas.width; px++){
          const y = peakHold[px]
          if (px===0) ctx.moveTo(px, y)
          else ctx.lineTo(px, y)
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      // hover crosshair + tooltip
      if (hoverX>=0){
        const px = Math.max(0, Math.min(canvas.width-1, Math.round(hoverX)))
        const hz = minHz * Math.pow(10, (px/canvas.width) * Math.log10(maxHz/minHz))
        const bin = binsPerPx[px]
        const v = data[bin]
        let db = toDb(v)
        const oct = Math.log2(hz/minHz)
        db += slopeDbPerOct*oct*-1
        const y = yForDb(db)
        ctx.save()
        ctx.strokeStyle='rgba(255,255,255,0.15)'
        ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,canvas.height); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke()
        // tooltip
        const label = `${hz<1000? hz.toFixed(1)+' Hz' : (hz/1000).toFixed(2)+' kHz'}  ${db.toFixed(1)} dB`
        ctx.font = `${12*dpr}px ui-sans-serif,system-ui`;
        const tw = ctx.measureText(label).width + 10*dpr
        const th = 18*dpr
        const tx = Math.min(px+8*dpr, canvas.width - tw - 4*dpr)
        const ty = Math.max(4*dpr, y - th - 6*dpr)
        ctx.fillStyle = 'rgba(17,17,27,0.92)'
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,4*dpr); ctx.fill(); ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillText(label, tx+5*dpr, ty+12*dpr)
        ctx.restore()
      }
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', onRes); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave) }
  }, [dockVisOn, visRidgeOn, visRidgeDecay, visSlope, visSmooth, isPlaying])

  // EQ canvas: live spectrum + EQ response + draggable band handles, theme-reactive
  useEffect(()=>{
    if (!eqOpen) return
    ensureAudioGraph()
    const canvas = document.getElementById('eq-curve')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const resize = ()=>{ canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr }
    resize(); const onRes=()=>resize(); window.addEventListener('resize', onRes)
    const analyser = analyserRef.current
    if (analyser) { analyser.fftSize = 4096 }
    const minHz=32, maxHz=20000
    const toX = (hz, w)=> Math.log10(hz/minHz)/Math.log10(maxHz/minHz) * w
    const toDbY = (db, h)=> {
      const y = h * (0.5 - db/30)
      return Math.max(0, Math.min(h, y))
    }
    const width = ()=> canvas.width, height=()=> canvas.height
    // Theme palette
    const root = getComputedStyle(document.documentElement)
    const primaryRaw = root.getPropertyValue('--primary').trim() || '265 89% 78%'
    const [ph] = primaryRaw.split(/\s+/)
    const baseHue = Number(ph)||265
    const bandHues = EQ_BANDS.map((_,i)=> ((baseHue - 40) + i*12)%360 )
    canvas.style.touchAction = 'none'
    // Block ctrl+wheel zoom and smart gestures while EQ is open
    const guardWheel = (e)=>{ if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation() } }
    const guardGesture = (e)=>{ e.preventDefault(); e.stopPropagation() }
    const guardDouble = (e)=>{ if (e.detail > 1) { e.preventDefault(); e.stopPropagation() } }
    const guardKeys = (e)=>{ const k=e.key; if (e.metaKey && (k==='=' || k==='+' || k==='-' || k==='0')) { e.preventDefault(); e.stopPropagation() } }
    document.addEventListener('wheel', guardWheel, true)
    window.addEventListener('gesturestart', guardGesture, false)
    window.addEventListener('gesturechange', guardGesture, false)
    window.addEventListener('gestureend', guardGesture, false)
    window.addEventListener('mousedown', guardDouble, true)
    window.addEventListener('keydown', guardKeys, true)
    const prevSelect = document.body.style.userSelect; document.body.style.userSelect='none'
    let raf=0
    // Dragging state
    const drag = { idx: -1, mode: 'gain' }
    const getBandPoint = (i)=>({ x: toX(EQ_BANDS[i], width()), y: toDbY(eqGains[i]||0, height()) })
    const onDown = (e)=>{
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const px = (e.clientX - rect.left)*dpr
      const py = (e.clientY - rect.top)*dpr
      // nearest band
      let best=-1, bestD=1e9
      for (let i=0;i<EQ_BANDS.length;i++){
        const p = getBandPoint(i)
        const d = Math.hypot(p.x-px, p.y-py)
        if (d<bestD){ bestD=d; best=i }
      }
      if (best>=0){ 
        drag.idx = best; drag.mode = (e.altKey||e.metaKey)? 'q' : 'gain';
        drag.lastY = py;
        try { canvas.setPointerCapture?.(e.pointerId) } catch {}
      }
    }
    const onMove = (e)=>{
      if (drag.idx<0) return
      e.preventDefault(); e.stopPropagation()
      const rect = canvas.getBoundingClientRect()
      const py = (e.clientY - rect.top)*dpr
      if (drag.mode==='gain'){
        let db = (0.5 - (py/height()))*30
        db = Math.max(-12, Math.min(12, db))
        const g=[...eqGains]; g[drag.idx]=db; setEqGains(g); applyEqGains(g)
      } else {
        // Q adjust via relative vertical delta for stability
        const delta = (drag.lastY - py) / 300
        let q = (eqQ[drag.idx]||1.1) + delta
        q = Math.max(0.2, Math.min(3, q))
        const qq=[...eqQ]; qq[drag.idx]=q; setEqQ(qq); applyEqQ(qq)
      }
      drag.lastY = py
    }
    const onUp = (e)=>{ drag.idx=-1; try { canvas.releasePointerCapture?.(e.pointerId) } catch {} e.preventDefault(); e.stopPropagation() }
    const onDbl = (e)=>{ // reset nearest
      e.preventDefault(); e.stopPropagation()
      const rect = canvas.getBoundingClientRect()
      const px = (e.clientX - rect.left)*dpr
      const py = (e.clientY - rect.top)*dpr
      let best=-1, bestD=1e9
      for (let i=0;i<EQ_BANDS.length;i++){
        const p = getBandPoint(i)
        const d = Math.hypot(p.x-px, p.y-py)
        if (d<bestD){ bestD=d; best=i }
      }
      if (best>=0){ const g=[...eqGains]; g[best]=0; setEqGains(g); applyEqGains(g) }
    }
    // Use pointer events and capture to avoid browser gestures
    canvas.addEventListener('pointerdown', onDown, { passive: false })
    canvas.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { passive: false })
    canvas.addEventListener('dblclick', onDbl)

    // Use WebAudio frequency response for precise curve if filters exist
    const computeEqDb = (freqs)=>{
      const filters = filtersRef.current||[]
      const n = freqs.length
      const total = new Float32Array(n).fill(1)
      const tmpMag = new Float32Array(n)
      const tmpPhase = new Float32Array(n)
      for (const f of filters){ try{ f.getFrequencyResponse(freqs, tmpMag, tmpPhase); for(let i=0;i<n;i++) total[i]*=tmpMag[i]||1 }catch{} }
      const outDb = new Float32Array(n)
      for (let i=0;i<n;i++) outDb[i] = 20*Math.log10(Math.max(1e-6, total[i]))
      return outDb
    }
    // Precompute EQ curve only when sizes or EQ params change
    let dbArrMemo = null
    const recomputeCurve = ()=>{
      const n = Math.max(200, Math.floor(width()/ (dpr>1? 1.5 : 1))) // reduce resolution slightly for perf
      const freqs = new Float32Array(n)
      for (let px=0; px<n; px++) freqs[px] = minHz * Math.pow(10, (px/n)*Math.log10(maxHz/minHz))
      dbArrMemo = computeEqDb(freqs)
    }
    recomputeCurve()

    const draw = ()=>{
      raf = requestAnimationFrame(draw)
      ctx.clearRect(0,0,width(),height())
      // grid
      ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1
      const gridDb=[-12,-6,0,6,12]
      for(const db of gridDb){ const y = toDbY(db, height()); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width(),y); ctx.stroke() }
      const marks=[32,64,125,250,500,1000,2000,4000,8000,16000]
      for(const hz of marks){ const x = toX(hz, width()); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height()); ctx.stroke() }
      ctx.restore()

      // live spectrum background (idle-safe)
      if (analyser && (isPlaying || (audioRef.current?.readyState>=2) )){
        const freqBins = analyser.frequencyBinCount
        const data = new Uint8Array(freqBins)
        analyser.getByteFrequencyData(data)
        const path = new Path2D(); path.moveTo(0,height())
        const nyquist = (audioCtxRef.current?.sampleRate||44100)/2
        const hzPerBin = nyquist / freqBins
        const smooth=2
        for (let px=0; px<width(); px++){
          const hz = minHz * Math.pow(10, (px/width())*Math.log10(maxHz/minHz))
          const bin = Math.min(freqBins-1, Math.max(0, Math.round(hz / hzPerBin)))
          let sum=0,c=0; for(let k=-smooth;k<=smooth;k++){ const idx=Math.min(freqBins-1, Math.max(0, bin+k)); sum+=data[idx]; c++ }
          const v=sum/c; let db = 20*Math.log10(Math.max(1e-4, v/255))
          if (!isPlaying) db = -100 // show flat line when not playing
          const y = toDbY(db, height())
          path.lineTo(px, y)
        }
        path.lineTo(width(), height()); path.closePath()
        const grad = ctx.createLinearGradient(0,0,0,height())
        grad.addColorStop(0, `hsla(${baseHue} 95% 70% / 0.28)`); grad.addColorStop(1, `hsla(${baseHue} 90% 50% / 0.03)`)
        ctx.fillStyle = grad
        ctx.fill(path)
      }

      // precise EQ response + band fills (use memo curve, scale to canvas width)
      const n = dbArrMemo?.length || 0
      const dbArr = dbArrMemo
      // band area fills
      const bandRanges = EQ_BANDS.map((f,i)=>{ const lo=i===0?32:Math.sqrt(EQ_BANDS[i-1]*f); const hi=i===EQ_BANDS.length-1?20000:Math.sqrt(EQ_BANDS[i+1]*f); return [lo,hi] })
      for (let i=0;i<EQ_BANDS.length;i++){
        const [lo,hi] = bandRanges[i]
        const start = Math.floor(toX(lo,width())), end = Math.ceil(toX(hi,width()))
        const p = new Path2D(); p.moveTo(start, toDbY(0, height()))
        for (let px=start; px<=end; px++){
          const idx = Math.min(n-1, Math.floor((px/width())*(n-1)))
          p.lineTo(px, toDbY(dbArr[idx]||0, height()))
        }
        p.lineTo(end, toDbY(0, height())); p.closePath()
        const h = bandHues[i]; const g = ctx.createLinearGradient(0,0,0,height())
        g.addColorStop(0, `hsla(${h} 95% 65% / 0.25)`); g.addColorStop(1, `hsla(${h} 85% 50% / 0.04)`)
        ctx.fillStyle = g; ctx.fill(p)
      }
      const curve = new Path2D(); curve.moveTo(0, toDbY(dbArr[0]||0, height()))
      for (let px=1; px<width(); px++){
        const idx = Math.min(n-1, Math.floor((px/width())*(n-1)))
        curve.lineTo(px, toDbY(dbArr[idx]||0, height()))
      }
      ctx.shadowColor = `hsla(${baseHue} 100% 80% / 0.4)`; ctx.shadowBlur = 8
      ctx.strokeStyle = `hsla(${baseHue} 100% 80% / 0.95)`
      ctx.lineWidth = 2.4
      ctx.stroke(curve)
      ctx.shadowBlur = 0
      // band handles
      for (let i=0;i<EQ_BANDS.length;i++){
        const p = getBandPoint(i)
        ctx.beginPath(); ctx.arc(p.x, p.y, 6*dpr, 0, Math.PI*2)
        ctx.fillStyle = `hsla(${bandHues[i]} 90% 60% / 0.95)`
        ctx.shadowColor = `hsla(${bandHues[i]} 100% 60% / 0.8)`
        ctx.shadowBlur = 12
        ctx.fill(); ctx.shadowBlur=0
        ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1; ctx.stroke()
        // tooltip bubble
        const label = `${EQ_BANDS[i]>=1000? (EQ_BANDS[i]/1000).toFixed(0)+'k' : EQ_BANDS[i]}  ${(eqGains[i]||0).toFixed(1)} dB  Q ${(eqQ[i]||1.1).toFixed(2)}`
        const tw = ctx.measureText(label).width + 10
        const bx = Math.min(Math.max(4, p.x - tw/2), width()-tw-4), by = Math.max(4, p.y - 18)
        ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1
        ctx.beginPath(); ctx.roundRect(bx,by,tw,16,4); ctx.fill(); ctx.stroke()
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillText(label, bx+5, by+12)
      }
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', onRes); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); canvas.removeEventListener('dblclick', onDbl); document.removeEventListener('wheel', guardWheel, true); window.removeEventListener('gesturestart', guardGesture, false); window.removeEventListener('gesturechange', guardGesture, false); window.removeEventListener('gestureend', guardGesture, false); window.removeEventListener('mousedown', guardDouble, true); window.removeEventListener('keydown', guardKeys, true); document.body.style.userSelect = prevSelect }
  }, [eqOpen, eqGains, eqQ, eqOn])
  // In mini mode, receive now-playing snapshots from main renderer
  useEffect(() => {
    if (!isMiniMode) return
    try { window.electronAPI.onMiniNowPlaying?.((data)=> setMiniNow(data||null)) } catch {}
  }, [isMiniMode])
  // In main renderer, periodically report now-playing to mini window
  useEffect(() => {
    if (isMiniMode) return
    try { window.electronAPI.reportNowPlaying?.({ track: currentTrack, isPlaying, progress, duration, volume }) } catch {}
  }, [currentTrack, isPlaying, progress, duration, volume, isMiniMode])
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
            <img alt={t.title} src={t.thumbnail || '/assets/icons/celes-star.png'} className="w-full h-36 object-cover rounded bg-surface-muted" />
            <div className="text-sm font-medium line-clamp-2">{t.title}</div>
            <div className="text-xs text-muted-foreground">{t.artist} • {t.platform}</div>
            <div className="flex items-center justify-between mt-1">
              <Button className="flex-1" onClick={() => doPlay(t)}>Play</Button>
              <span className="flex items-center gap-2 ml-2">
                <button className="p-1 hover:text-primary" title="Add to queue" onClick={() => addToQueue(t)}><ListPlus size={16}/></button>
                <button className={`p-1 ${likedSet.has(keyForTrack(t))? 'text-primary' : 'hover:text-primary'}`} aria-label="Like" title="Like" onClick={async () => { const id = await persistTrack(t); if (id) { const res = await window.electronAPI.toggleLikeSong?.(id); const isLiked = !!res?.isLiked; setLikedSet(prev=>{ const next = new Set(Array.from(prev)); const k=keyForTrack(t); if (isLiked) next.add(k); else next.delete(k); try{ localStorage.setItem('celes.likedSet', JSON.stringify(Array.from(next))) }catch{}; return next }); await reloadPlaylists(); } }}><Heart size={16}/></button>
                <button className="p-1 hover:text-primary" title="Add to playlist" onClick={() => openPlaylistPickerForTrack(t)}><Plus size={16}/></button>
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
      if (saved) {
        applyThemeVars(saved)
      } else {
        const solar = THEMES.find(t=>t.name==='Solarized')
        if (solar) applyThemeVars(solar.vars)
      }
    } catch {}
  }, [])

  // Artist pages removed per request

  function ThemePanel() {
    // Read current applied theme as the baseline for preview/revert
    const cs = getComputedStyle(document.documentElement)
    const initialPrimary = (cs.getPropertyValue('--primary') || '').trim()
    const initialBg = (cs.getPropertyValue('--background') || '0 0% 4%').trim()
    const initialFg = (cs.getPropertyValue('--foreground') || '0 0% 100%').trim()

    const [primary, setPrimary] = useState(initialPrimary)
    const [bg, setBg] = useState(initialBg)
    const [fg, setFg] = useState(initialFg)
    const baselineRef = useRef({ '--primary': initialPrimary, '--background': initialBg, '--foreground': initialFg })
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
      // Update baseline so future closes won't revert this saved theme
      baselineRef.current = vars
      // Always close after saving
      setThemeOpen(false)
    }

    // Live preview on field changes
    useEffect(() => {
      const vars = { '--primary': primary.trim(), '--background': bg.trim(), '--foreground': fg.trim() }
      applyThemeVars(vars)
    }, [primary, bg, fg])

    // Revert unsaved changes on close/unmount
    useEffect(() => {
      return () => {
        try { applyThemeVars(baselineRef.current) } catch {}
      }
    }, [])

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

  function PlaylistPickerModal(){
    const [input, setInput] = useState('')
    const [creating, setCreating] = useState(false)
    const close = ()=>{ setPickerOpen(false); setPickerTrack(null); setInput(''); setCreating(false) }
    const choose = async (pid)=>{ if(!pickerTrack) return; await addTrackToDbPlaylist(pid, pickerTrack); close() }
    const create = async ()=>{ const name = input.trim(); if(!name) return; setCreating(true); await createPlaylist(name); await reloadPlaylists(); const pl = playlists.find(p=>p.name===name) || (await reloadPlaylists(), playlists.find(p=>p.name===name)); if(pl) await choose(pl.id); setCreating(false) }
    if (!pickerOpen) return null
    return (
      <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center" onClick={close}>
        <div className="w-[420px] max-h-[70vh] overflow-auto bg-surface border border-border rounded p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <div className="text-sm font-semibold mb-2">Add to playlist</div>
          <div className="space-y-2">
            {(playlists||[]).map(pl=> (
              <div key={pl.id} className="flex items-center justify-between border border-border rounded px-2 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-surface-muted overflow-hidden flex items-center justify-center">
                    {playlistCovers[pl.id] ? <img src={playlistCovers[pl.id]} alt="cover" className="w-full h-full object-cover"/> : <span className="text-[10px] text-muted-foreground">★</span>}
                  </div>
                  <div className="text-xs font-medium truncate">{pl.name}</div>
                </div>
                <Button variant="ghost" onClick={()=>choose(pl.id)}>Add</Button>
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="text-xs text-muted-foreground">Create new</div>
            <div className="flex gap-2">
              <input className="flex-1 bg-surface-muted border border-border rounded px-2 py-1 text-sm" placeholder="New playlist name" value={input} onChange={(e)=>setInput(e.target.value)} />
              <Button onClick={create} disabled={creating || !input.trim()}>{creating? 'Creating…':'Create'}</Button>
            </div>
          </div>
          <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={close}>Close</Button></div>
        </div>
      </div>
    )
  }
  function NewPlaylistModal(){
    if (!newPlaylistOpen) return null
    const [name, setName] = React.useState(`Playlist ${playlists.length+1}`)
    const [busy, setBusy] = React.useState(false)
    const close = ()=>{ if(!busy) setNewPlaylistOpen(false) }
    const create = async ()=>{
      const n = (name||'').trim(); if(!n) return;
      setBusy(true)
      try { await createPlaylist(n) } finally { setBusy(false); setNewPlaylistOpen(false) }
    }
    return (
      <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center" onClick={close}>
        <div className="w-[360px] bg-surface border border-border rounded p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <div className="text-sm font-semibold mb-2">New playlist</div>
          <input className="w-full bg-surface-muted border border-border rounded px-2 py-1 text-sm" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Playlist name" />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={create} disabled={!name.trim() || busy}>{busy? 'Creating…':'Create'}</Button>
          </div>
        </div>
      </div>
    )
  }

  function RenamePlaylistModal(){
    if (!renameOpen || !renameTarget) return null
    const [name, setName] = React.useState(renameTarget.name || '')
    const close = ()=>{ setRenameOpen(false); setRenameTarget(null) }
    const save = async ()=>{ const n=(name||'').trim(); if(!n) return; await renamePlaylist(renameTarget.id, n); close() }
    return (
      <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center" onClick={close}>
        <div className="w-[360px] bg-surface border border-border rounded p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <div className="text-sm font-semibold mb-2">Rename playlist</div>
          <input className="w-full bg-surface-muted border border-border rounded px-2 py-1 text-sm" value={name} onChange={(e)=>setName(e.target.value)} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={!name.trim()}>Save</Button>
          </div>
        </div>
      </div>
    )
  }

  function PlaylistView(){
    const pl = activePlaylist
    if (!pl) return (
      <div className="bg-surface border border-border rounded p-3">
        <div className="text-sm text-muted-foreground">No playlist selected</div>
      </div>
    )
    return (
      <div className="bg-surface border border-border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">{pl.name} <span className="text-muted-foreground">({pl.songs?.length || 0})</span></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { setRenameTarget({ id: pl.id, name: pl.name }); setRenameOpen(true) }}>Rename</Button>
            <Button variant="ghost" onClick={async () => { const items = (pl.songs||[]).map(t=>({ id: t.stream_id||t.id, stream_id: String(t.stream_id||t.id), platform: t.platform||'youtube', title: t.title, artist: t.artist, streamUrl: t.stream_url||t.streamUrl })); if(items.length===0){ alert('Nothing to download'); return } const settings = await window.electronAPI.getSettings?.()||{}; const dir = settings.downloadDir || window.prompt?.('Download folder'); if(!dir) return; await window.electronAPI.downloadQueueAdd?.(items, dir) }}>Download</Button>
            <Button variant="ghost" onClick={async () => { const settings = await window.electronAPI.getSettings?.()||{}; const dir = settings.downloadDir || window.prompt?.('Download folder'); if(!dir) return; const existing = await window.electronAPI.getDownloads?.(); const byId = new Set((existing||[]).map(d=>d.song_id)); const items = (pl.songs||[]).filter(t=>!byId.has(t.id)).map(t=>({ id: t.stream_id||t.id, stream_id: String(t.stream_id||t.id), platform: t.platform||'youtube', title: t.title, artist: t.artist, streamUrl: t.stream_url||t.streamUrl })); if(items.length===0){ alert('Nothing new'); return } await window.electronAPI.downloadQueueAdd?.(items, dir) }}>Download Missing</Button>
            <Button variant="ghost" onClick={async () => { if (confirm(`Delete playlist "${pl.name}"?`)) { await window.electronAPI.deletePlaylist?.(pl.id); await reloadPlaylists(); setActivePlaylistId(null); setView('home') } }}>Delete</Button>
          </div>
        </div>
        <div className="space-y-1">
          {(!pl.songs || pl.songs.length === 0) && (
            <div className="text-xs text-muted-foreground">Empty — go to Search and click + to add songs.</div>
          )}
          {(pl.songs || []).map((t, idx) => (
            <div key={`${t.id}_${idx}`} className="text-xs flex items-center gap-2">
              <img src={t.thumbnail_url || t.thumbnail || '/assets/icons/celes-star.png'} className="w-8 h-8 rounded object-cover bg-surface-muted"/>
              <div className="flex-1 truncate">{t.title}</div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => doPlay({ ...t, platform: t.platform || (t.type === 'stream' ? t.platform : 'internetarchive') })}>Play</Button>
                <Button variant="ghost" onClick={async ()=>{ await window.electronAPI.removeSongFromPlaylist?.(pl.id, t.id); await reloadPlaylists(); }}>Remove</Button>
                <Button variant="ghost" onClick={async ()=>{ await window.electronAPI.moveSongInPlaylist?.(pl.id, t.id, Math.max(0, idx-1)); await reloadPlaylists(); }}>↑</Button>
                <Button variant="ghost" onClick={async ()=>{ await window.electronAPI.moveSongInPlaylist?.(pl.id, t.id, Math.min((pl.songs?.length||1)-1, idx+1)); await reloadPlaylists(); }}>↓</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function CommandPalette(){
    const [input, setInput] = useState('')
    const commands = [
      {name:'Go Home', run:()=>setView('home')},
      {name:'Open Search', run:()=>setView('search')},
       {name:'New Playlist', run:()=>{ const n=window.prompt?.('New playlist name','My Playlist'); if(n) createPlaylist(n)}},
      {name:'Toggle Theme Panel', run:()=>setThemeOpen(v=>!v)},
      {name:'Open Liked Songs', run:()=>{ const liked=playlists.find(p=>p.name==='Liked Songs'); if(liked) setActivePlaylistId(liked.id); }}
    ]
    const filtered = commands.filter(c=>c.name.toLowerCase().includes(input.toLowerCase()))
    return (
      <div className="fixed inset-0 z-50 bg-background/40 flex items-start justify-center pt-32" onClick={()=>setPaletteOpen(false)}>
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
            const targetDir = settings.downloadDir || window.prompt?.('Download folder')
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

  function LibraryView(){
    return (
      <div className="bg-surface border border-border rounded p-3">
        <div className="text-sm font-semibold mb-2">Library</div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold mb-2">Liked Songs ({likedSongs?.length||0})</div>
            {(!likedSongs || likedSongs.length===0) && (
              <div className="text-xs text-muted-foreground">Nothing liked yet</div>
            )}
            <div className="space-y-1">
              {(likedSongs||[]).map((t, idx)=> (
                <div key={`${t.id||t.stream_id||idx}`} className="text-xs flex items-center gap-2 border border-border rounded p-2">
                  <img src={t.thumbnail_url || t.thumbnail || '/assets/icons/celes-star.svg'} className="w-7 h-7 rounded object-cover bg-surface-muted"/>
                  <div className="flex-1 truncate">{t.title}</div>
                  <span className="flex items-center gap-1">
                    <Button variant="ghost" onClick={()=> doPlay({ ...t, platform: t.platform || (t.type==='stream' ? t.platform : 'internetarchive') })}>Play</Button>
                    <Button variant="ghost" onClick={()=> addToQueue(t)}>Queue</Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
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
          <div className="flex items-center justify-between"><div>Equalizer</div><input type="checkbox" checked={eqOn} onChange={(e)=>{ const v=e.target.checked; setEqOn(v); try{ localStorage.setItem('celes.eqOn', String(v)) }catch{}; if(v) ensureAudioGraph(); }} /></div>
          <div className="flex items-center justify-between"><div>Lyrics</div><input type="checkbox" checked={lyricsEnabled} onChange={(e)=>{ const v=e.target.checked; setLyricsEnabled(v); try{ localStorage.setItem('celes.lyricsEnabled', String(v)) }catch{} }} /></div>
          <div className="flex items-center justify-between"><div>Auto open lyrics</div><input type="checkbox" checked={autoOpenLyrics} onChange={(e)=>{ const v=e.target.checked; setAutoOpenLyrics(v); try{ localStorage.setItem('celes.autoOpenLyrics', String(v)) }catch{} }} /></div>
          <div className="flex items-center justify-between"><div>Show mini lyric</div><input type="checkbox" checked={showMiniLyric} onChange={(e)=>{ const v=e.target.checked; setShowMiniLyric(v); try{ localStorage.setItem('celes.showMiniLyric', String(v)) }catch{} }} /></div>
          <div className="flex gap-2 items-center">
            <div>Preset:</div>
            <select className="bg-surface-muted border border-border rounded px-2 py-1" onChange={(e)=>setEqPreset(e.target.value)}>
              {Object.keys(EQ_PRESETS).map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {EQ_BANDS.map((f,i)=> (
              <div key={f} className="flex flex-col items-center">
                <div className="text-[10px] mb-1">{f/1000>=1?`${f/1000}k`:`${f}`}</div>
                <input type="range" min={-12} max={12} step={0.5} value={eqGains[i]||0} onChange={(e)=>{ const g=[...eqGains]; g[i]=Number(e.target.value); setEqGains(g); applyEqGains(g) }} className="h-20 rotate-[-90deg] origin-left w-24" />
                <input type="range" min={0.1} max={3} step={0.05} value={eqQ[i]||1.1} onChange={(e)=>{ const q=[...eqQ]; q[i]=Number(e.target.value); setEqQ(q); applyEqQ(q) }} className="h-16 rotate-[-90deg] origin-left w-20 mt-2" />
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
              <Button variant="ghost" onClick={async ()=>{ const dir = window.prompt?.('Set download folder', downloadDir || '/Users/'+(navigator.userAgent.includes('Mac')?'eoinfr':'')+'/Music/Celes'); if(dir){ setDownloadDir(dir); await persistSettings({ ...(await window.electronAPI.getSettings?.()||{}), autoDownloadLiked, downloadDir: dir }) } }}>Choose</Button>
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
      const target = settings.downloadDir || window.prompt?.('Download folder')
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

  if (isMiniMode) {
    const t = miniNow?.track || currentTrack
    const playing = miniNow?.isPlaying ?? isPlaying
    const prog = Number(miniNow?.progress ?? progress) || 0
    const dur = Number(miniNow?.duration ?? duration) || 0
    const vol = Number(miniNow?.volume ?? volume) || 0
    return (
      <div className="relative min-h-screen text-[hsl(var(--foreground))] flex items-center mini-window select-none"
           style={{ background: 'transparent' }}>
        <div className="w-full h-full px-3 pt-6 pb-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/96 shadow-lg">
        {/* macOS-like traffic lights (green expands back) */}
        <div className="absolute top-2 left-3 flex items-center gap-2 no-drag">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background:'#ff5f57', opacity:0.9 }} />
          <span className="inline-block w-3 h-3 rounded-full" style={{ background:'#ffbd2e', opacity:0.9 }} />
          <button
            title="Expand"
            className="inline-block w-3 h-3 rounded-full ring-0 focus:outline-none"
            style={{ background:'#28c840' }}
            onClick={()=>{ try { window.electronAPI.showMainWindow?.() } catch {} }}
          />
        </div>
        {/* Keep audio elements in DOM for WebAudio context even if this window isn't the primary player */}
        <div className="hidden">
          <audio id="audio-el" ref={audioRef} preload="auto" crossOrigin="anonymous" />
          <audio id="audio-next" ref={nextAudioRef} preload="auto" crossOrigin="anonymous" />
        </div>
        <div className="w-full">
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
            {/* Art */}
            <img src={t?.thumbnail || '/assets/icons/celes-star.png'} className="w-11 h-11 rounded object-cover no-drag" alt="art" />
            {/* Meta */}
            <div className="min-w-0 pr-2">
              <div className="text-sm font-semibold truncate leading-5">{t?.title || 'Nothing playing'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{t?.artist || ''}</div>
            </div>
            {/* Transport */}
            <div className="flex items-center gap-2 no-drag">
            <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>{ try { window.electronAPI.sendRendererCommand?.('previous') } catch {} }} aria-label="Previous"><SkipBack size={16} /></button>
              <button className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={()=>{ try { window.electronAPI.sendRendererCommand?.('toggle-play') } catch {} }} aria-label="Play/Pause">{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
            <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>{ try { window.electronAPI.sendRendererCommand?.('next') } catch {} }} aria-label="Next"><SkipForward size={16} /></button>
          </div>
            {/* Volume */}
            <div className="flex items-center gap-2 w-36 no-drag">
            <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>{ try { window.electronAPI.sendRendererCommand?.('set-volume', { volume: vol > 0 ? 0 : 0.8 }) } catch {} }} aria-label="Mute">{vol > 0 ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>
              <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e)=>{ const v=Number(e.target.value); try { window.electronAPI.sendRendererCommand?.('set-volume', { volume: v }) } catch {} }} className="w-20 accent-primary range-thin" />
            </div>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-2 no-drag">
            <span className="text-[11px] text-muted-foreground w-10 text-right">{fmtTime(prog)}</span>
            <input type="range" min={0} max={Math.max(1, dur)} step="any" value={Math.min(prog, dur || 0)}
                   onChange={(e)=>{ const time = Number(e.target.value); setMiniNow(prev=> ({ ...(prev||{}), progress: time })); try { window.electronAPI.sendRendererCommand?.('seek', { time }) } catch {} }}
                   className="flex-1 accent-primary range-thin" />
            <span className="text-[11px] text-muted-foreground w-10">{fmtTime(dur)}</span>
          </div>
          </div>
        </div>
      </div>
    )
  }

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
            {(view === 'home' || view === 'search') && (
              <>
                {view==='home' && homeLoading && (
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
                {view==='home' && !homeLoading && (<>
                  {view==='home' && explore && (
                    <>
                      <SectionCard title={`New Releases • ${chartsDate}`} items={explore.newReleases||[]} />
                      <SectionCard title={`Trending Now • ${chartsDate}`} items={explore.trending||[]} />
                      {exploreHistory.length>0 && (
                        <div className="space-y-3">
                          {exploreHistory.map((b, i)=> (
                            <SectionCard key={`hist_${i}`} title={`From ${b.title}`} items={b.results||[]} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {!explore && <div className="text-sm text-muted-foreground">Loading explore…</div>}
                </>)}
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
                   <img alt={t.title} src={t.thumbnail || '/assets/icons/celes-star.png'} className="w-full h-36 object-cover rounded" />
                  <div className="text-sm font-medium line-clamp-2">{t.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span><button className="underline" onClick={()=>loadArtist(t.artist)}>{t.artist}</button> • {t.platform}</span>
                        <span className="flex items-center gap-2">
                          <button className="p-1 hover:text-primary" title="Add to queue" onClick={() => addToQueue(t)}><ListPlus size={16}/></button>
                          <button className={`p-1 ${likedSet.has(keyForTrack(t))? 'text-primary' : 'hover:text-primary'}`} aria-label="Like" title="Like" onClick={async () => { const id = await persistTrack(t); if (id) { const res = await window.electronAPI.toggleLikeSong?.(id); const isLiked = !!res?.isLiked; setLikedSet(prev=>{ const next = new Set(Array.from(prev)); const k=keyForTrack(t); if (isLiked) next.add(k); else next.delete(k); try{ localStorage.setItem('celes.likedSet', JSON.stringify(Array.from(next))) }catch{}; return next }); const fresh = await window.electronAPI.getLikedSongs?.(); if (Array.isArray(fresh)) setLikedSongs(fresh) } }}>
                            <Heart size={16}/>
                          </button>
                          <button className="p-1 hover:text-primary" title="Add to playlist" onClick={() => openPlaylistPickerForTrack(t)}><Plus size={16}/></button>
                        </span>
                      </div>
                      <div className="mt-1">
                        <Button className="w-full" onClick={() => doPlay(t)}>Play</Button>
                  </div>
                </div>
              ))}
            </div>
                  </>
                )}
              </>
            )}
            {/* Artist view removed */}
            {view === 'playlist' && (
              <div className="space-y-3">
                {/* Keep the search row on top for discovery while viewing a playlist */}
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface border border-border">
                  <input className="bg-transparent outline-none text-sm w-full" placeholder="Search to add more…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setView('search'); doSearch() } }} />
                  <Button onClick={()=>{ setView('search'); doSearch() }} disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
                </div>
              <PlaylistView />
              </div>
            )}
            {view === 'downloads' && (
              <DownloadsView />
            )}
            {view === 'library' && (
              <LibraryView />
            )}
          </section>

          <aside className="hidden md:flex flex-col gap-3">
            <div className="bg-surface border border-border rounded p-3">
              <div className="text-sm font-semibold mb-2">Queue</div>
              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {queue.length === 0 && <div className="text-xs text-muted-foreground">Queue is empty</div>}
                {queue.map((q, i) => (
                  <div key={`${q.id}_${i}`} className="text-xs flex items-center gap-2">
                    <img src={q.thumbnail || '/assets/icons/celes-star.png'} className="w-8 h-8 rounded object-cover"/>
                    <div className="flex-1 truncate">{q.title}</div>
                    <Button variant="ghost" onClick={() => playNext(q)}>Play next</Button>
                    <Button variant="ghost" onClick={() => removeFromQueue(i)}>Remove</Button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <aside className="hidden lg:flex flex-col gap-3">
            {/* Hidden audio elements (kept in DOM for playback, no visible UI) */}
            <div className="hidden">
              <audio id="audio-el" ref={audioRef} preload="auto" crossOrigin="anonymous" />
              <audio id="audio-next" ref={nextAudioRef} preload="auto" crossOrigin="anonymous" />
            </div>
            <div className="bg-surface border border-border rounded p-3">
              <div className="text-sm font-semibold mb-2">Playlists</div>
              <div className="flex gap-2 mb-2">
                <Button onClick={() => setNewPlaylistOpen(true)}>New</Button>
              </div>
              <div className="space-y-2">
                {playlists.filter(p=>p.type==='user').length===0 && (
                  <div className="text-xs text-muted-foreground">No playlists yet</div>
                )}
                {playlists.filter(p=>p.type==='user').map(p => (
                  <div key={p.id} className={`border rounded p-2 ${activePlaylistId===p.id?'border-primary':'border-border'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center" style={{ background: (p.cover_color||'').trim() || 'hsl(var(--surface-muted))' }}>
                          {playlistCovers[p.id] ? <img src={playlistCovers[p.id]} alt="cover" className="w-full h-full object-cover"/> : <span className="text-[10px] text-muted-foreground">★</span>}
                        </div>
                        <div className="text-xs font-medium truncate">{p.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => openPlaylistPage(p.id)}>Open</Button>
                        <Button variant="ghost" onClick={async ()=>{ const c = window.prompt?.('Set color (CSS value, e.g. #7c3aed or hsl(280 80% 60%))', p.cover_color || '#7c3aed'); if(!c) return; await window.electronAPI.updatePlaylistColor?.(p.id, c); await reloadPlaylists() }}>Color</Button>
                      </div>
                             </div>
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
      {pickerOpen && <PlaylistPickerModal />}
      {newPlaylistOpen && <NewPlaylistModal />}
      {renameOpen && <RenamePlaylistModal />}
      {eqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={()=>setEqOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-[880px] max-w-[92vw] bg-[hsl(var(--surface))] border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold">Equalizer</div>
              <div className="flex items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={eqOn} onChange={(e)=>{ const v=e.target.checked; setEqOn(v); try{ localStorage.setItem('celes.eqOn', String(v)) }catch{}; if(v) ensureAudioGraph(); }} /> Enabled</label>
                <input className="px-2 py-1 bg-surface-muted border border-border rounded" value={presetName} onChange={(e)=>setPresetName(e.target.value)} style={{width:140}} />
                <Button variant="ghost" onClick={()=> saveCurrentPreset(presetName||'Custom') }>Save</Button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={()=> storePreset('A') }>Store A</Button>
                  <Button variant="ghost" onClick={()=> storePreset('B') }>Store B</Button>
                  <Button variant="ghost" onClick={()=> recallPreset('A') }>A</Button>
                  <Button variant="ghost" onClick={()=> recallPreset('B') }>B</Button>
                </div>
                <Button variant="ghost" onClick={()=>setEqOpen(false)}>Close</Button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs mb-3">
                <div>Preset:</div>
                <select className="bg-surface-muted border border-border rounded px-2 py-1" onChange={(e)=>setEqPreset(e.target.value)}>
                  {Object.keys(EQ_PRESETS).map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
          <div className="relative h-[360px] rounded-lg border border-border bg-gradient-to-b from-white/2 to-black/10">
            <canvas id="eq-curve" className="absolute inset-0" />
            <div className="absolute top-3 left-3 flex items-center gap-2 text-[11px]">
              <div className="rounded border border-border overflow-hidden">
                {['Basic','Advanced','Expert'].map(m => (
                  <button key={m} className={`px-2 py-1 ${eqMode===m? 'bg-surface-muted text-foreground' : 'text-muted-foreground'}`} onClick={()=>{ setEqMode(m); try{ localStorage.setItem('celes.eqMode', m) }catch{} }}>{m}</button>
                ))}
              </div>
              <label className="ml-2 flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visRidgeOn} onChange={(e)=>{ const v=e.target.checked; setVisRidgeOn(v); try{ localStorage.setItem('celes.visRidgeOn', String(v)) }catch{} }} /> Ridge</label>
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span>Slope</span><input type="range" min={0} max={6} step={0.5} value={visSlope} onChange={(e)=>{ const v=Number(e.target.value); setVisSlope(v); try{ localStorage.setItem('celes.visSlope', String(v)) }catch{} }} />
                <span>Smooth</span><input type="range" min={0} max={6} step={1} value={visSmooth} onChange={(e)=>{ const v=Number(e.target.value); setVisSmooth(v); try{ localStorage.setItem('celes.visSmooth', String(v)) }catch{} }} />
                <span>Decay</span><input type="range" min={0} max={3} step={0.1} value={visRidgeDecay} onChange={(e)=>{ const v=Number(e.target.value); setVisRidgeDecay(v); try{ localStorage.setItem('celes.visRidgeDecay', String(v)) }catch{} }} />
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}
      {miniDockOn && (
        <div className="fixed bottom-24 right-4 z-40 bg-surface/95 border border-border rounded shadow-xl p-3 w-[340px]">
          <div className="text-sm font-semibold mb-2 flex items-center justify-between">
            <span>Mini Dock</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={dockVisOn} onChange={(e)=>{ const v=e.target.checked; setDockVisOn(v); try{ localStorage.setItem('celes.dockVisOn', String(v)) }catch{} }} /> Spectrum</label>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <img src={currentTrack?.thumbnail || '/assets/icons/celes-star.svg'} className="w-12 h-12 rounded object-cover bg-surface-muted p-1"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{currentTrack?.title || 'Nothing playing'}</div>
              <div className="text-xs text-muted-foreground truncate">{currentTrack?.artist || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded hover:bg-surface-muted" onClick={previousOrRestart}><SkipBack size={16}/></button>
              <button className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlayPause}>{isPlaying? <Pause size={16}/> : <Play size={16}/>}</button>
              <button className="p-2 rounded hover:bg-surface-muted" onClick={()=>nextFromQueue()}><SkipForward size={16}/></button>
              <button className="p-2 rounded hover:bg-surface-muted" onClick={()=> setEqOpen(true) } title="Equalizer">EQ</button>
            </div>
          </div>
          {dockVisOn && (
            <div className="mt-2 rounded overflow-hidden border border-border bg-background/60 relative" style={{height: 160}}>
                <canvas id="dock-vis" className="w-full h-full" />
              <div className="absolute mt-2 right-5 -translate-y-8 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-surface/70 border border-border">Log</span>
                <span className="px-2 py-0.5 rounded bg-surface/70 border border-border">Peak</span>
              </div>
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
              {currentTrack ? (<img alt={currentTrack.title} src={currentTrack.thumbnail || '/assets/icons/celes-star.png'} className="w-full h-full object-cover" />) : (<span className="text-xs text-muted-foreground">♫</span>)}
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
            <div className="hidden md:flex items-center gap-2 w-64 justify-end">
            <button className="p-2 rounded hover:bg-surface-muted" onClick={() => setVolume(v => v > 0 ? 0 : 0.8)} aria-label="Mute">{volume > 0 ? <Volume2 size={18}/> : <VolumeX size={18}/>} </button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32 accent-primary" />
            {showMiniLyric && miniLyric && <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{miniLyric}</div>}
            <Button variant="ghost" onClick={async()=>{ if(!currentTrack) return; setLyricsOpen(v=>!v); if(!lyricsData){ setLyricsData({ loading:true }); const meta = { artist: currentTrack.artist, title: currentTrack.title, duration: currentTrack.duration }; const l = await window.electronAPI.getLyricsForTrack?.(meta); setLyricsData(l||{plainLyrics:'No lyrics found'}); } }}>Lyrics</Button>
            <Button variant="ghost" onClick={()=>setTheaterOn(true)}>Theater</Button>
          </div>
        </div>
      </div>
      {lyricsOpen && (
        <div className="fixed inset-0 z-50 bg-background/60 flex items-center justify-center" onClick={()=>setLyricsOpen(false)}>
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
        <div className="fixed inset-0 z-50 bg-background">
          {!videoOn && <canvas id="vis" className="absolute inset-0 opacity-40" />}
          {videoOn && (
            <video ref={videoRef} src={videoUrl||''} className="absolute inset-0 w-full h-full object-contain bg-background" controls={false} muted playsInline autoPlay onCanPlay={()=>{ try { videoRef.current?.play?.() } catch {} }} />
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
            {!videoOn && <img src={currentTrack?.thumbnail || '/assets/icons/celes-star.png'} className="w-[36vmin] h-[36vmin] rounded shadow-lg object-cover" alt="art" />}
            <div className="text-3xl font-bold text-foreground max-w-[80vw] text-center truncate">{currentTrack?.title||'Nothing playing'}</div>
            <div className="text-lg text-foreground/80 truncate max-w-[70vw]">{currentTrack?.artist||''}</div>
            <div className="flex items-center gap-6">
              <button className="px-5 py-3 rounded bg-surface hover:bg-surface-muted border border-border text-foreground" onClick={togglePlayPause}>{isPlaying? 'Pause':'Play'}</button>
              <button className="px-5 py-3 rounded bg-surface hover:bg-surface-muted border border-border text-foreground" onClick={()=>nextFromQueue()}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



