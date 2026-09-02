# Assertion budgets

`--fail-on <severities>` answers one question: should any finding at these severities fail the run.
It cannot say "no criticals, at most three highs, at most twenty findings in total". An `assert`
block in your config can.

```js
// sniff.config.mjs
export default {
  assert: {
    maxCritical: 0,
    maxHigh: 3,
    maxTotal: 20,
  },
};
```

Every key is optional and takes a non-negative integer:

| Key | Caps |
| --- | --- |
| `maxCritical` | findings at severity `critical` |
| `maxHigh` | findings at severity `high` |
| `maxMedium` | findings at severity `medium` |
| `maxLow` | findings at severity `low` |
| `maxInfo` | findings at severity `info` |
| `maxTotal` | findings at any severity |

A breach prints one line per budget on stderr and exits 1:

```
Budget exceeded: assert.maxHigh: 4 high findings, budget 3
Budget exceeded: assert.maxTotal: 26 findings, budget 20
```

## How it combines with --fail-on

The block is additive. It can turn a passing run into a failing one; it can never turn a failing run
into a passing one. `--fail-on` keeps its current meaning and its `critical,high` default. A project
with no `assert` key behaves exactly as it did before.

## Where it applies

- The flow-walk, which is `sniff` and `sniff --url`. Evaluated over the findings the report shows,
  so a hidden low-confidence finding cannot fail your build on its own. Pass `--all` to include them
  in the report and in the budget.
- The source scan, which is `sniff scan`, and the browser audit.
- Discovery, which is `sniff --discover`. Evaluated over the findings inside its scenarios, and
  OR-ed with the existing rule that any non-quarantined scenario failure fails the run. Findings
  from quarantined scenarios are excluded, so a budget cannot re-block a failure the quarantine
  deliberately excused.

There is no `minScore` key. The only score in sniff is a per-URL Lighthouse performance number,
never a run-wide grade, so a score budget would have no defined subject.
