import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Setup Node DOM environment for Canvas & Image
class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = '';
    this.width = 0;
    this.height = 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._native = null;
  }
  get src() {
    return this._src;
  }
  set src(val) {
    this._src = val;
    let promise;
    if (val.startsWith('blob:') && globalThis._lastBlobBuffer) {
      promise = loadImage(globalThis._lastBlobBuffer);
    } else if (val.startsWith('data:')) {
      const b64 = val.split(',')[1];
      promise = loadImage(Buffer.from(b64, 'base64'));
    } else {
      promise = loadImage(val);
    }
    promise
      .then((loaded) => {
        this.width = loaded.width;
        this.height = loaded.height;
        this.naturalWidth = loaded.width;
        this.naturalHeight = loaded.height;
        this._native = loaded;
        if (this.onload) this.onload();
      })
      .catch((err) => {
        if (this.onerror) this.onerror(err);
      });
  }
}

globalThis.Image = MockImage;
globalThis._blobMap = new Map();
let blobCounter = 0;

globalThis.URL.createObjectURL = function (blob) {
  const id = 'blob:node/' + ++blobCounter;
  globalThis._blobMap.set(id, blob);
  return id;
};

globalThis.URL.revokeObjectURL = function (url) {
  globalThis._blobMap.delete(url);
};

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      let width = 1;
      let height = 1;
      let nativeCanvas = createCanvas(width, height);
      let nativeCtx = nativeCanvas.getContext('2d');

      const canvasWrapper = {
        get width() {
          return width;
        },
        set width(val) {
          width = val;
          nativeCanvas.width = val;
        },
        get height() {
          return height;
        },
        set height(val) {
          height = val;
          nativeCanvas.height = val;
        },
        getContext(type, opts) {
          return {
            drawImage(image, ...args) {
              const actual = image instanceof MockImage ? image._native : image;
              return nativeCtx.drawImage(actual, ...args);
            },
            getImageData(sx, sy, sw, sh) {
              return nativeCtx.getImageData(sx, sy, sw, sh);
            },
          };
        },
        toBlob(callback, type = 'image/png', quality = 0.92) {
          const mime = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          const buf = nativeCanvas.toBuffer(mime);
          globalThis._lastBlobBuffer = buf;
          const blob = new Blob([buf], { type: mime });
          callback(blob);
        },
      };
      return canvasWrapper;
    }
    return {};
  },
};

const jiti = createJiti(projectRoot);
const { auditImageClient } = jiti('./src/forensicsClient.ts');

export async function runPipelineOnSample(filePath, category) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const file = new File([buf], path.basename(filePath), { type: mimeType });
  file.filePath = filePath;

  const native = await loadImage(buf);
  const img = new MockImage();
  img.width = native.width;
  img.height = native.height;
  img.naturalWidth = native.width;
  img.naturalHeight = native.height;
  img._native = native;

  const res = await auditImageClient(file, img);

  const readings = {};
  for (const d of res.details || []) {
    readings[d.test] = {
      reading: d.reading,
      result: d.result,
      statusType: d.statusType,
    };
  }

  return {
    filename: path.basename(filePath),
    category,
    per_detector_readings: readings,
    final_score: res.risk,
    final_verdict: res.verdict,
    verdict_type: res.verdictType,
    quality: res.quality || null,
    summary: res.summary,
  };
}

async function main() {
  const samplesDir = path.join(projectRoot, 'eval', 'samples');
  const baselineDir = path.join(projectRoot, 'eval', 'baseline');
  const baselineOutFile = path.join(baselineDir, 'baseline_results.json');

  if (fs.existsSync(baselineOutFile)) {
    console.error('ERROR: baseline_results.json already exists! Per rule #5, it is read-only and must never be regenerated.');
    process.exit(1);
  }

  fs.mkdirSync(baselineDir, { recursive: true });

  const categories = [
    'real_camera',
    'real_webcam',
    'real_whatsapp',
    'real_pinterest',
    'ai_clean',
    'ai_whatsapp',
    'ai_pinterest',
    'screenshot',
  ];

  console.log('================================================================');
  console.log('                FREEZING FORENSIC BASELINE                      ');
  console.log('================================================================\n');

  const allResults = [];
  const categoryStats = {};

  for (const cat of categories) {
    const catDir = path.join(samplesDir, cat);
    if (!fs.existsSync(catDir)) {
      console.log(`[!] Category directory missing: ${cat}`);
      continue;
    }

    const files = fs.readdirSync(catDir).filter((f) => !f.startsWith('.'));
    if (files.length === 0) {
      console.log(`[!] Category is empty: ${cat}`);
      continue;
    }

    console.log(`Scanning category [${cat}] (${files.length} files)...`);
    categoryStats[cat] = { total: files.length, correct: 0, fp: 0, fn: 0, inconclusive: 0 };

    for (const f of files) {
      const filePath = path.join(catDir, f);
      const res = await runPipelineOnSample(filePath, cat);
      allResults.push(res);

      const isRealCat = cat.startsWith('real_') || cat === 'screenshot';
      const isAiCat = cat.startsWith('ai_');
      const v = (res.final_verdict || '').toLowerCase();
      const isClassifiedReal = v.includes('real');
      const isClassifiedAi = v.includes('ai') || v.includes('deepfake') || v.includes('confirmed');
      const isInconclusive = v === 'inconclusive';

      if (isInconclusive) {
        categoryStats[cat].inconclusive++;
      }

      if (isRealCat) {
        if (isClassifiedReal || (cat === 'screenshot' && isInconclusive)) {
          categoryStats[cat].correct++;
        } else if (isClassifiedAi) {
          categoryStats[cat].fp++;
        }
      } else if (isAiCat) {
        if (isClassifiedAi) {
          categoryStats[cat].correct++;
        } else if (isClassifiedReal) {
          categoryStats[cat].fn++;
        }
      }

      console.log(`  • ${f.padEnd(35)} -> Score: ${String(res.final_score).padStart(4)}% | Verdict: ${res.final_verdict}`);
    }
  }

  // Save baseline results to JSON
  fs.writeFileSync(baselineOutFile, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n[+] Baseline results saved to: ${baselineOutFile}`);

  // Summary Metrics
  console.log('\n================================================================');
  console.log('                   BASELINE METRICS SUMMARY                     ');
  console.log('================================================================');

  let totalReal = 0;
  let totalRealFP = 0;
  let totalAi = 0;
  let totalAiFN = 0;

  for (const [cat, stats] of Object.entries(categoryStats)) {
    const acc = ((stats.correct / stats.total) * 100).toFixed(1);
    console.log(`Category: ${cat.padEnd(16)} | Total: ${stats.total} | Accuracy: ${acc}% (Correct: ${stats.correct}, Inconclusive: ${stats.inconclusive})`);

    if (cat.startsWith('real_') || cat === 'screenshot') {
      totalReal += stats.total;
      totalRealFP += stats.fp;
    } else if (cat.startsWith('ai_')) {
      totalAi += stats.total;
      totalAiFN += stats.fn;
    }
  }

  const fpRate = totalReal > 0 ? ((totalRealFP / totalReal) * 100).toFixed(2) : '0.00';
  const fnRate = totalAi > 0 ? ((totalAiFN / totalAi) * 100).toFixed(2) : '0.00';

  console.log('----------------------------------------------------------------');
  console.log(`Real Images False Positive Rate (FP Rate) : ${fpRate}% (${totalRealFP}/${totalReal})`);
  console.log(`AI Images False Negative Rate (FN Rate)   : ${fnRate}% (${totalAiFN}/${totalAi})`);
  console.log(`Total Samples Evaluated                    : ${allResults.length}`);
  console.log('================================================================\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error('Fatal error in run_baseline:', err);
    process.exit(1);
  });
}
