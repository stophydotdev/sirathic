export function refreshing<Result>(
  load: () => Promise<Result | undefined>,
  apply: (result: Result) => void,
) {
  let running: Promise<void> | undefined;
  let latest = 0;
  const start = () => {
    const mine = ++latest;
    const started = load()
      .then((result) => {
        if (result !== undefined && mine === latest) apply(result);
      })
      .finally(() => {
        if (mine === latest) running = undefined;
      });
    running = started;
    return started;
  };
  return { join: () => running ?? start(), fresh: start };
}
