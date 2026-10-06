// Explicit live Gemini check; intentionally excluded from the offline test suite.
import { loadEnvConfig } from '@next/env';
import { generateAppeal } from '../lib/appeals';
import { demos } from '../lib/demos';

loadEnvConfig(process.cwd());

async function main() {
  const scenarios: [number, string, boolean][] = [
    [0, "Okay, you win, it's a chair.", true],
    [0, "It isn't a chair.", false],
    [0, "You want me to say it's a chair.", false],
    [0, 'What happens if I agree?', false],
    [2, "Okay, you win, it's not a chair.", true],
    [2, "Fine, it's a chair.", false],
    [2, "You want me to say it's not a chair.", false],
    [2, 'What happens if I agree?', false],
  ];
  // Bound concurrency and log only test inputs and decisions, never credentials.
  for (let offset = 0; offset < scenarios.length; offset += 4) {
    const batch = scenarios.slice(offset, offset + 4);
    const outcomes = await Promise.allSettled(batch.map(async ([index, objection, expected]) => {
      const report = demos[index].report;
      const result = await generateAppeal(report, [], objection);
      const passed = result.conceded === expected;
      console.log(`${passed ? 'PASS' : 'FAIL'} | ${report.verdict} | ${JSON.stringify(objection)} | conceded=${result.conceded}`);
      return passed;
    }));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        console.error('Live concession verification could not reach a valid model result. No credentials were logged.');
        process.exitCode = 1;
      } else if (!outcome.value) process.exitCode = 1;
    }
    if (outcomes.every(outcome => outcome.status === 'rejected')) break;
  }
}

void main();
