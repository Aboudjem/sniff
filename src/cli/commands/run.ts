export async function runCommand(): Promise<void> {
  const pc = (await import('picocolors')).default;
  console.log(
    pc.yellow(
      "sniff run is coming in a future release. Use 'sniff scan' for source code scanning.",
    ),
  );
}
