export default (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeout = 10000
) => {
  const controller = new AbortController();
  const { signal } = controller;

  setTimeout(() => controller.abort(), timeout);

  return fetch(input, { ...init, signal });
};
