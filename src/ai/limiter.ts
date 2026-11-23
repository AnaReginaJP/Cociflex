// Limits how many recipes the local model generates at once (it runs on a CPU).
export class BusyError extends Error {
  constructor() {
    super('La IA local está ocupada.');
  }
}

type Release = () => void;

interface Waiting {
  resolve: (release: Release) => void;
  reject: (error: Error) => void;
}

export function createLimiter(maxConcurrent: number, maxWaiting: number) {
  let active = 0;
  const waiting: Waiting[] = [];

  const makeRelease = (): Release => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      active--;
      next();
    };
  };

  function next() {
    while (active < maxConcurrent && waiting.length > 0) {
      const entry = waiting.shift()!;
      active++;
      entry.resolve(makeRelease());
    }
  }

  return {
    acquire(signal?: AbortSignal): Promise<Release> {
      if (active < maxConcurrent) {
        active++;
        return Promise.resolve(makeRelease());
      }
      if (waiting.length >= maxWaiting) return Promise.reject(new BusyError());
      return new Promise<Release>((resolve, reject) => {
        const entry: Waiting = { resolve, reject };
        waiting.push(entry);
        signal?.addEventListener(
          'abort',
          () => {
            const index = waiting.indexOf(entry);
            if (index >= 0) {
              waiting.splice(index, 1);
              reject(new Error('aborted'));
            }
          },
          { once: true }
        );
      });
    },
    stats: () => ({ active, waiting: waiting.length }),
  };
}
