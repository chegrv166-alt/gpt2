/** Query-only links work over HTTP and file:// and preserve desktop presentation. */
export function viewHref(view: 'game' | 'forge'): string {
  const parameters = new URLSearchParams(window.location.search);
  if (view === 'forge') parameters.set('view', 'forge');
  else parameters.delete('view');
  return `?${parameters.toString()}`;
}
