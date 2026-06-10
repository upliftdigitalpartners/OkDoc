/** "2125550101" → "(212) 555-0101"; anything unexpected passes through. */
export function formatUsPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return digits;
}

export function telHref(digits: string): string {
  return `tel:+1${digits.replace(/\D/g, '')}`;
}

export function directionsHref(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
