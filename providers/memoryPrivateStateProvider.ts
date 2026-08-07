// --- MEMORY PRIVATE STATE PROVIDER ---
// @ts-ignore
export class MemoryPrivateStateProvider implements PrivateStateProvider<
  string,
  any
> {
  private state: any;
  private signingKey: any = null;

  constructor(initialState: any) {
    this.state = initialState;
  }

  async get(id: string): Promise<any> {
    return this.state;
  }

  async set(id: string, state: any): Promise<void> {
    this.state = state;
  }

  async remove(id: string): Promise<void> {
    this.state = null;
  }

  async setContractAddress(address: string): Promise<void> {}

  async getSigningKey(address: any): Promise<any> {
    return this.signingKey;
  }

  async setSigningKey(address: any, key: any): Promise<void> {
    this.signingKey = key;
  }

  async removeSigningKey(address: any): Promise<void> {
    this.signingKey = null;
  }

  async clear(): Promise<void> {
    this.state = null;
    this.signingKey = null;
  }
}
