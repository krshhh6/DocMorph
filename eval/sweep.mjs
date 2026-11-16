import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipelineOnSample } from './run_baseline.mjs';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const jiti = createJiti(projectRoot);
const { forensicsConfig, setForensicsConfig } = jiti('./src/forensicsConfig.ts');

const baselineFile = path.join(projectRoot, 'eval', 'baseline', 'baseline_results.json');
const baselineResults = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
const samplesDir = path.join(projectRoot, 'eval', 'samples');

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

const weights = [0, 0.15, 0.25, 0.35, 0.5];
const sweepResults = {};

async function evaluateForWeight(w) {
  setForensicsConfig({
    useQualityBadge: true,
    useAiClassifier: w > 0,
    aiClassifierWeight: w,
  });

  const catStats = {};
  for (const cat of categories) {
    catStats[cat] = {
      total: 0,
      baseCorrect: 0,
      nowCorrect: 0,
      baseFp: 0,
      nowFp: 0,
      baseFn: 0,
      nowFn: 0,
    };
  }

  let regressions = 0;

  for (const baseItem of baselineResults) {
    const { filename, category } = baseItem;
    const filePath = path.join(samplesDir, category, filename);
    if (!fs.existsSync(filePath)) continue;

    const nowItem = await runPipelineOnSample(filePath, category);
    const stats = catStats[category];
    stats.total++;

    const isRealCat = category.startsWith('real_') || category === 'screenshot';
    const isAiCat = category.startsWith('ai_');

    const baseVerdict = (baseItem.final_verdict || '').toLowerCase();
    const nowVerdict = (nowItem.final_verdict || '').toLowerCase();

    const baseIsReal = baseVerdict.includes('real');
    const baseIsAi = baseVerdict.includes('ai') || baseVerdict.includes('deepfake') || baseVerdict.includes('confirmed');
    const baseIsInc = baseVerdict === 'inconclusive';

    const nowIsReal = nowVerdict.includes('real');
    const nowIsAi = nowVerdict.includes('ai') || nowVerdict.includes('deepfake') || nowVerdict.includes('confirmed');
    const nowIsInc = nowVerdict === 'inconclusive';

    let baseCorrect = false;
    let nowCorrect = false;

    if (isRealCat) {
      baseCorrect = baseIsReal || (category === 'screenshot' && baseIsInc);
      nowCorrect = nowIsReal || (category === 'screenshot' && nowIsInc);
      if (nowIsAi) stats.nowFp++;
      if (baseIsAi) stats.baseFp++;
    } else if (isAiCat) {
      baseCorrect = baseIsAi;
      nowCorrect = nowIsAi;
      if (nowIsReal) stats.nowFn++;
      if (baseIsReal) stats.baseFn++;
    }

    if (baseCorrect) stats.baseCorrect++;
    if (nowCorrect) stats.nowCorrect++;

    if (baseCorrect && !nowCorrect) {
      regressions++;
    }
  }

  let totalReal = 0;
  let totalNowRealFp = 0;
  for (const cat of categories) {
    if (cat.startsWith('real_') || cat === 'screenshot') {
      totalReal += catStats[cat].total;
      totalNowRealFp += catStats[cat].nowFp;
    }
  }

  const fpRate = totalReal > 0 ? (totalNowRealFp / totalReal) * 100 : 0;
  return { catStats, regressions, fpRate, totalNowRealFp, totalReal };
}

async function run() {
  console.log('Starting Sweep over w in {0, 0.15, 0.25, 0.35, 0.5}...');
  for (const w of weights) {
    process.stdout.write(`Evaluating w = ${w}... `);
    const res = await evaluateForWeight(w);
    sweepResults[w] = res;
    console.log(`Done. Regressions: ${res.regressions}, Real FP Rate: ${res.fpRate.toFixed(2)}%`);
  }

  console.log('\n========================================================================================');
  console.log('                              SWEEP ACCURACY PER CATEGORY TABLE                         ');
  console.log('========================================================================================');
  
  let header = 'Category'.padEnd(16) + ' | Baseline';
  for (const w of weights) {
    header += ` | w = ${w.toFixed(2)}`;
  }
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const cat of categories) {
    let row = cat.padEnd(16);
    const baseStats = sweepResults[0].catStats[cat];
    const baseAcc = ((baseStats.baseCorrect / baseStats.total) * 100).toFixed(1) + '%';
    row += ` | ${baseAcc.padStart(8)}`;

    for (const w of weights) {
      const s = sweepResults[w].catStats[cat];
      const acc = ((s.nowCorrect / s.total) * 100).toFixed(1) + '%';
      row += ` | ${acc.padStart(8)}`;
    }
    console.log(row);
  }

  console.log('-'.repeat(header.length));
  let fpRow = 'Real FP Rate'.padEnd(16) + ` | ${('0.00%').padStart(8)}`;
  for (const w of weights) {
    fpRow += ` | ${(sweepResults[w].fpRate.toFixed(2) + '%').padStart(8)}`;
  }
  console.log(fpRow);

  let regRow = 'Regressions'.padEnd(16) + ` | ${('0').padStart(8)}`;
  for (const w of weights) {
    regRow += ` | ${(sweepResults[w].regressions.toString()).padStart(8)}`;
  }
  console.log(regRow);
  console.log('========================================================================================\n');
}

run().catch(console.error);
