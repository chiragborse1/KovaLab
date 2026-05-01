// Kova's npm tarball should stay comfortably below a 50 MiB unpacked budget.
// This still leaves room for staged runtime dependencies while catching pack
// bloat quickly during release validation.
export const NPM_PACK_UNPACKED_SIZE_BUDGET_BYTES = 50 * 1024 * 1024;

export function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function resolvePackResultLabel(entry, index) {
  return entry.filename?.trim() || `pack result #${index + 1}`;
}

export function formatPackUnpackedSizeBudgetError(params) {
  const budgetBytes = params.budgetBytes ?? NPM_PACK_UNPACKED_SIZE_BUDGET_BYTES;
  return [
    `${params.label} unpackedSize ${params.unpackedSize} bytes (${formatMiB(params.unpackedSize)}) exceeds budget ${budgetBytes} bytes (${formatMiB(budgetBytes)}).`,
    "Investigate duplicate channel shims, copied extension trees, or other accidental pack bloat before release.",
  ].join(" ");
}

export function collectPackUnpackedSizeErrors(results, options = {}) {
  const entries = Array.from(results);
  const errors = [];
  const budgetBytes = options.budgetBytes ?? NPM_PACK_UNPACKED_SIZE_BUDGET_BYTES;
  let checkedCount = 0;

  for (const [index, entry] of entries.entries()) {
    if (typeof entry.unpackedSize !== "number" || !Number.isFinite(entry.unpackedSize)) {
      continue;
    }
    checkedCount += 1;
    if (entry.unpackedSize <= budgetBytes) {
      continue;
    }
    errors.push(
      formatPackUnpackedSizeBudgetError({
        budgetBytes,
        label: resolvePackResultLabel(entry, index),
        unpackedSize: entry.unpackedSize,
      }),
    );
  }

  if (entries.length > 0 && checkedCount === 0) {
    errors.push(
      options.missingDataMessage ??
        "npm pack --dry-run produced no unpackedSize data; pack size budget was not verified.",
    );
  }

  return errors;
}
