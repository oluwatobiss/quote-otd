export function copyShareLink(contractAddress: string | null) {
  if (contractAddress) {
    const url = `${window.location.origin}${window.location.pathname}?contract=${contractAddress}`;
    navigator.clipboard.writeText(url);
  }
}
