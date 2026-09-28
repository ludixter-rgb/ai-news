// Renders motion/index.html frame-by-frame in headless Chromium and muxes it with
// the synthesized soundtrack into an MP4.
//   node motion/render.js                      → motion/motion-study-01.mp4
//   node motion/render.js --stills 60,240,480  → PNG stills only (for review)
//   options: --sub N (motion-blur subsamples, default 4)  --out path
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const SUB = Number(args.sub || 4);
const OUT = path.resolve(args.out || path.join(__dirname, 'motion-study-01.mp4'));
const FFMPEG = process.env.FFMPEG || execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render');
  await page.evaluate(() => window.ready);

  const grab = async f => Buffer.from((await page.evaluate(([f, s]) => window.frameDataURL(f, s), [f, SUB])).split(',')[1], 'base64');

  if (args.stills) {
    const dir = args.dir || path.join(__dirname, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const frames = args.stills.split(',').map(Number);
    // render sequentially from the earliest so the particle sim sees monotonic time
    for (const f of frames.sort((a, b) => a - b)) fs.writeFileSync(path.join(dir, `f${String(f).padStart(3, '0')}.png`), await grab(f));
    await browser.close();
    return;
  }

  const wav = path.join(path.dirname(OUT), 'soundtrack.wav');
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.renderAudioWav()), 'base64'));
  console.log('audio →', wav);

  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < 900; f++) {
    const buf = await grab(f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/900  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('video →', OUT);
})();
