export class FetchZkConfigProvider<Circuits extends string> {
  getZkir(circuitName: Circuits): Promise<Uint8Array> {
    return this.fetchBytes(`/zkir/${circuitName}.zkir`);
  }
  async getProverKey(circuitName: Circuits): Promise<any> {
    return new Uint8Array(
      await (await fetch(`/keys/${circuitName}_pk.bincode`)).arrayBuffer(),
    );
  }
  async getVerifierKey(circuitName: Circuits): Promise<any> {
    return new Uint8Array(
      await (await fetch(`/keys/${circuitName}_vk.bincode`)).arrayBuffer(),
    );
  }
  private async fetchBytes(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
