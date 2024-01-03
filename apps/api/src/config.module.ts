import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { Config } from "./config.js";

/** Injection token for the parsed Config (see config.ts). */
export const CONFIG = Symbol("CONFIG");

/** Makes the Config available to every provider without anyone touching process.env. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
