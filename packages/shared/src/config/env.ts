export interface EnvReader {
  get(name: string): string | undefined;
  require(name: string): string;
}

export const env: EnvReader = {
  get(name) {
    const value = process.env[name];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  },
  require(name) {
    const value = this.get(name);
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  },
};
