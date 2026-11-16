import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipelineOnSample } from './run_baseline.mjs';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const jiti = createJiti(projectRoot);
const { forensicsConfig } = jiti('./src/forensicsConfig.ts');

async function main() {
  const baselineFile = path.join(projectRoot, 'eval', 'baseline', 'baseline_results.json');
  if (!fs.existsSync(baselineFile)) {
    console.error('ERROR: baseline_results.json not found! Run eval/run_baseline.mjs first.');
    process.exit(1);
  }

  const baselineResults = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
  const samplesDir = path.join(projectRoot, 'eval', 'samples');

  console.log('================================================================');
  console.log('             REGRESSION HARNESS (BASELINE VS CURRENT)           ');
  console.log('================================================================');
  console.log('Active Configuration Flags:');
  console.log(JSON.stringify(forensicsConfig, null, 2));
  console.log('----------------------------------------------------------------\n');

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

  const currentResults = [];
  const flips = [];
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
      scoreDiffs: [],
    };
  }

  for (const baseItem of baselineResults) {
    const { filename, category } = baseItem;
    const filePath = path.join(samplesDir, category, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[!] Sample file missing: ${filePath}`);
      continue;
    }

    process.stdout.write(`  Processing [${currentResults.length + 1}/${baselineResults.length}]: ${filename} (${category})...\n`);
    const nowItem = await runPipelineOnSample(filePath, category);
    currentResults.push(nowItem);

    const stats = catStats[category];
    stats.total++;

    const isRealCat = category.startsWith('real_') || category === 'screenshot';
    const isAiCat = category.startsWith('ai_');

    // Classification interpretation
    const baseVerdict = (baseItem.final_verdict || '').toLowerCase();
    const nowVerdict = (nowItem.final_verdict || '').toLowerCase();

    const baseIsReal = baseVerdict.includes('real');
    const baseIsAi = baseVerdict.includes('ai') || baseVerdict.includes('deepfake') || baseVerdict.includes('confirmed');
    const baseIsInc = baseVerdict === 'inconclusive';

    const nowIsReal = nowVerdict.includes('real');
    const nowIsAi = nowVerdict.includes('ai') || nowVerdict.includes('deepfake') || nowVerdict.includes('confirmed');
    const nowIsInc = nowVerdict === 'inconclusive';

    // Correctness logic
    let baseCorrect = false;
    let nowCorrect = false;

    if (isRealCat) {
      baseCorrect = baseIsReal || (category === 'screenshot' && baseIsInc);
      nowCorrect = nowIsReal || (category === 'screenshot' && nowIsInc);

      if (baseIsAi) stats.baseFp++;
      if (nowIsAi) stats.nowFp++;
    } else if (isAiCat) {
      baseCorrect = baseIsAi;
      nowCorrect = nowIsAi;

      if (baseIsReal) stats.baseFn++;
      if (nowIsReal) stats.nowFn++;
    }

    if (baseCorrect) stats.baseCorrect++;
    if (nowCorrect) stats.nowCorrect++;

    // Score shifts
    if (baseItem.final_score !== null && nowItem.final_score !== null) {
      stats.scoreDiffs.push(nowItem.final_score - baseItem.final_score);
    }

    // Verdict flips
    if (baseItem.final_verdict !== nowItem.final_verdict) {
      let flipType = 'neutral';
      if (!baseCorrect && nowCorrect) {
        flipType = 'improved (wrong -> right)';
      } else if (baseCorrect && !nowCorrect) {
        flipType = 'REGRESSED (right -> wrong)';
      }

      flips.push({
        filename,
        category,
        baseline: `${baseItem.final_verdict} (${baseItem.final_score}%)`,
        now: `${nowItem.final_verdict} (${nowItem.final_score}%)`,
        type: flipType,
      });
    }
  }

  // Report Section 1: Per-category Accuracy & Score Shifts
  console.log('----------------------------------------------------------------');
  console.log('CATEGORY COMPARISON (BASELINE vs NOW):');
  console.log('----------------------------------------------------------------');
  let hasAccuracyDrop = false;
  let totalReal = 0;
  let totalBaseRealFp = 0;
  let totalNowRealFp = 0;

  for (const cat of categories) {
    const s = catStats[cat];
    if (s.total === 0) continue;

    const baseAcc = ((s.baseCorrect / s.total) * 100).toFixed(1);
    const nowAcc = ((s.nowCorrect / s.total) * 100).toFixed(1);
    const deltaAcc = (parseFloat(nowAcc) - parseFloat(baseAcc)).toFixed(1);

    if (parseFloat(nowAcc) < parseFloat(baseAcc)) {
      hasAccuracyDrop = true;
    }

    const avgShift = s.scoreDiffs.length > 0 ? (s.scoreDiffs.reduce((a, b) => a + b, 0) / s.scoreDiffs.length).toFixed(1) : '0.0';

    const deltaSign = parseFloat(deltaAcc) >= 0 ? `+${deltaAcc}%` : `${deltaAcc}%`;
    const shiftSign = parseFloat(avgShift) >= 0 ? `+${avgShift}` : `${avgShift}`;

    console.log(
      `${cat.padEnd(16)} | Base: ${baseAcc.padStart(5)}% | Now: ${nowAcc.padStart(5)}% (${deltaSign.padStart(6)}) | Avg Score Shift: ${shiftSign.padStart(5)} pts`
    );

    if (cat.startsWith('real_') || cat === 'screenshot') {
      totalReal += s.total;
      totalBaseRealFp += s.baseFp;
      totalNowRealFp += s.nowFp;
    }
  }

  // Report Section 2: False Positive Rate on Real Images
  console.log('----------------------------------------------------------------');
  const baseFpRate = totalReal > 0 ? ((totalBaseRealFp / totalReal) * 100).toFixed(2) : '0.00';
  const nowFpRate = totalReal > 0 ? ((totalNowRealFp / totalReal) * 100).toFixed(2) : '0.00';
  const fpHigher = parseFloat(nowFpRate) > parseFloat(baseFpRate);

  console.log(`Real Images FP Rate : Baseline ${baseFpRate}% (${totalBaseRealFp}/${totalReal}) -> Now ${nowFpRate}% (${totalNowRealFp}/${totalReal})`);
  console.log('----------------------------------------------------------------');

  // Report Section 3: Flips
  console.log('\nVERDICT FLIPS:');
  if (flips.length === 0) {
    console.log('  None. All verdicts identical to baseline.');
  } else {
    for (const f of flips) {
      console.log(`  • [${f.type.toUpperCase()}] ${f.filename} (${f.category}):`);
      console.log(`      Baseline : ${f.baseline}`);
      console.log(`      Current  : ${f.now}`);
    }
  }

  // Pass Criteria Evaluation
  const regressions = flips.filter((f) => f.type.includes('REGRESSED'));
  const hasRegressions = regressions.length > 0;

  console.log('\n================================================================');
  console.log('                    PASS / FAIL VERIFICATION                    ');
  console.log('================================================================');
  console.log(`Zero Regressions Check        : ${hasRegressions ? 'FAILED (' + regressions.length + ' regressions)' : 'PASSED (0 regressions)'}`);
  console.log(`No Accuracy Drop Check        : ${hasAccuracyDrop ? 'FAILED (accuracy dropped)' : 'PASSED (no category dropped)'}`);
  console.log(`Real FP Rate Not Higher Check : ${fpHigher ? 'FAILED (FP rate increased)' : 'PASSED (FP rate <= baseline)'}`);

  const passed = !hasRegressions && !hasAccuracyDrop && !fpHigher;
  console.log(`\nOVERALL HARNESS RESULT        : ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('================================================================\n');

  if (!passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in compare harness:', err);
  process.exit(1);
});
