import { ZKConfigProvider, type ZKIR } from "@midnight-ntwrk/midnight-js-types";

export class FetchZkConfigReadonlyProvider<
  Circuits extends string,
> extends ZKConfigProvider<Circuits> {
  private get baseUrl(): string {
    // @ts-ignore
    return import.meta.env?.DEV ? "/contracts/managed/quote-otd" : "";
  }

  getZKIR(circuitName: Circuits): Promise<ZKIR> {
    return this.fetchBytes(`${this.baseUrl}/zkir/${circuitName}.zkir`) as any;
  }
  async getProverKey(circuitName: Circuits): Promise<any> {
    return this.fetchBytes(`${this.baseUrl}/keys/${circuitName}.prover`);
  }
  async getVerifierKey(circuitName: Circuits): Promise<any> {
    return this.fetchBytes(`${this.baseUrl}/keys/${circuitName}.verifier`);
  }
  private async fetchBytes(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error(
        `Failed to fetch ${url}: Server returned HTML instead of a valid file. File likely missing.`,
      );
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
