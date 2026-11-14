// A failed query must not be presented as an empty academic record.
export function requireSuccessfulQueries(results: readonly { error?: { message: string } | null }[]): void {
  const failed = results.find(result => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function withAcademicTimeout<T>(request: PromiseLike<T>, milliseconds = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('A consulta demorou mais que o esperado. Tente novamente.')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
