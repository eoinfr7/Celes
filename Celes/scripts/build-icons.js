/*
  Generate platform app icons from the brand SVG.
  - Input: assets/icons/celes-star.svg
  - Output: assets/icon.icns, assets/icon.ico, assets/icon.png (+ png set)
*/
const path = require('path')
const fs = require('fs')
const iconGen = require('icon-gen')

async function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }) }

function walk(dir, files=[]) {
  for (const entry of fs.readdirSync(dir)){
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

async function main(){
  const repoRoot = path.join(__dirname, '..')
  const src = path.join(repoRoot, 'assets', 'icons', 'celes-star.svg')
  const dest = path.join(repoRoot, 'assets')
  if (!fs.existsSync(src)) throw new Error('Missing source SVG: '+src)
  await ensureDir(dest)
  console.log('Generating icons from', src)
  await iconGen(src, dest, {
    report: true,
    modes: ['icns', 'ico', 'favicon', 'png'],
    ico: { sizes: [16,24,32,48,64,128,256] },
    icns: { sizes: [16,32,64,128,256,512,1024] },
    favicon: { background: '#00000000' },
  })

  // Find and place canonical files
  const produced = walk(dest)
  const byExt = (ext)=> produced.filter(p=>p.toLowerCase().endsWith(ext))
  const icns = byExt('.icns')[0]
  const ico = byExt('.ico')[0]
  const pngs = byExt('.png').sort((a,b)=>{
    const pa = parseInt(path.basename(a).split('x')[0])||0
    const pb = parseInt(path.basename(b).split('x')[0])||0
    return pb-pa
  })
  if (icns) fs.copyFileSync(icns, path.join(dest, 'icon.icns'))
  if (ico) fs.copyFileSync(ico, path.join(dest, 'icon.ico'))
  if (pngs[0]) fs.copyFileSync(pngs[0], path.join(dest, 'icon.png'))
  console.log('Wrote', path.join(dest,'icon.icns'), path.join(dest,'icon.ico'), path.join(dest,'icon.png'))
}

main().catch((e)=>{ console.error(e); process.exit(1) })


