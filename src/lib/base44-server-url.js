export function getBase44ServerUrl() {
  const isHostedOnBase44 = typeof window !== 'undefined' && window.location.hostname.endsWith('base44.app');
  return isHostedOnBase44 ? '' : 'https://base44.app';
}
