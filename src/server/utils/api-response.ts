export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data }, init);
}

export function fail(error: { category: string; message: string }, status = 400) {
  return Response.json({ ok: false, error }, { status });
}
